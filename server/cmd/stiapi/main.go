// Command stiapi is the sti.care blind backend: a single static binary serving
// the API over SQLite. Config is entirely from the environment.
package main

import (
	"context"
	"encoding/hex"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"runtime/debug"
	"strconv"
	"strings"
	"syscall"
	"time"

	"sti.care/api/internal/logring"
	"sti.care/api/internal/metrics"
	"sti.care/api/internal/server"
	"sti.care/api/internal/store"
)

// adminTokenMinLen is the boot-time length floor for STI_ADMIN_TOKEN when the
// admin surface is enabled (doc 20). 32 chars is comfortably above a guessable
// secret; the operator should use a long random value. Enforced loud at boot so a
// misconfigured deploy never exposes admin behind a weak token.
const adminTokenMinLen = 32

// logRingCapacity bounds the in-process buffer of recent log lines served at
// GET /admin/logs (doc 20). At the service's log volume this is days of history
// for a couple of MB; the buffer starts empty on every boot and the box's
// journal stays the deep archive.
const logRingCapacity = 5000

// restartExitCode is the deliberate non-zero exit of an admin-requested restart.
// The unit runs Restart=on-failure, which ignores a clean exit but revives this
// one after RestartSec; distinct from 1 (boot/config failures) so the journal
// shows an intended restart, not a crash.
const restartExitCode = 3

func main() {
	// Every log record also lands in an in-memory ring so the admin surface can
	// show recent lines (doc 20); stdout (the journal) stays the primary sink.
	ring := logring.New(logRingCapacity)
	log := slog.New(logring.Tee(
		slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}),
		ring,
	))

	addr := env("STI_ADDR", ":8080")
	dbPath := env("STI_DB_PATH", "sti.db")
	// Metrics listen address: loopback only, never public (doc 12 §5). It is a
	// SEPARATE listener, not fronted by Caddy, so it is never proxied to the
	// internet; the loopback bind plus ufw keep it local. OPT-IN: empty (the
	// default) and "off" both disable it, so the observability surface exists only
	// where explicitly configured (provisioned boxes set 127.0.0.1:9090). This
	// also keeps unconfigured contexts, e.g. the parallel integration-test harness,
	// from fighting over a fixed port.
	metricsAddr := env("STI_METRICS_ADDR", "")

	secret, err := decoySecret(os.Getenv("STI_DECOY_SECRET"))
	if err != nil {
		log.Error("STI_DECOY_SECRET", "err", err)
		os.Exit(1)
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	st, err := store.Open(ctx, dbPath)
	if err != nil {
		log.Error("open store", "err", err)
		os.Exit(1)
	}
	defer st.Close()

	// Comma-separated exact origins allowed to call the api from a browser
	// (e.g. "https://sti.care"). Empty disables CORS, correct for same-origin or
	// non-browser callers.
	allowedOrigins := splitList(os.Getenv("STI_ALLOWED_ORIGINS"))

	// Targeted-wake intake is ON by default now that the cover-wake decorrelation
	// fix has landed (doc 10 §F, doc 13 §2): a real wake never reaches its recipient
	// directly, it fans out one contentless cover wake across the whole push
	// population. STI_NOTIFY_ENABLED=false disables it. Two things still gate actual
	// DELIVERY: this flag AND a configured Web Push sender (VAPID keys). A box with
	// the flag on but no VAPID keys keeps the constant-time intake live and the drain
	// reclaims each queued wake instead of delivering it, so the queue never grows
	// unbounded; it simply wakes no one until keys are configured.
	notifyEnabled := os.Getenv("STI_NOTIFY_ENABLED") != "false"
	vapidPublic := os.Getenv("STI_VAPID_PUBLIC_KEY")
	var sender server.Sender
	if priv := os.Getenv("STI_VAPID_PRIVATE_KEY"); vapidPublic != "" && priv != "" {
		sender = server.NewWebPushSender(vapidPublic, priv, env("STI_VAPID_SUBJECT", "https://sti.care"))
	}
	if warn := notifyGateWarning(notifyEnabled, sender != nil); warn != "" {
		log.Warn(warn)
	}

	// Per-IP request limit on the non-sensitive endpoints. Zero leaves the
	// server's defaults (5/sec, burst 20); raise it for load tests or an
	// integration harness driving many writes from a single (loopback) IP, where
	// the production budget would otherwise throttle the run.
	ipRate := envFloat("STI_IP_RATE_PER_SEC", 0)
	ipBurst := envFloat("STI_IP_BURST", 0)

	// Concurrency cap, sensitive-read fallback timeout, and knock retention.
	// Lowering MaxInflight and SensitiveWait lets a test drive the shed and
	// uniform-overload paths deterministically; a short KnockTTL lets a test
	// exercise expiry. Non-positive values are clamped to 0 so withDefaults applies
	// (256, 5s, 4 days), rather than reaching server.New, where a negative cap
	// would panic make(chan) and a negative wait would fire the timer immediately.
	maxInflight := max(envInt("STI_MAX_INFLIGHT", 0), 0)
	sensitiveWait := max(envDuration("STI_SENSITIVE_WAIT", 0), 0)
	knockTTL := max(envDuration("STI_KNOCK_TTL", 0), 0)

	// Window over which the decorrelation cover broadcast spreads its per-route
	// wakes (doc 13 §2). Default 2 min; only matters once notify delivery is on.
	coverWindow := max(envDuration("STI_COVER_WINDOW", 2*time.Minute), 0)
	// Fixed wall-clock cadence of the SCHEDULED cover broadcast (doc 13 §2): the drain
	// fires a population-wide contentless wake once per interval regardless of whether
	// any real wake is pending, so the broadcast's timing leaks nothing about real
	// activity. Default 6h. A non-positive value is clamped to 0 so withDefaults applies
	// the default rather than disabling the heartbeat: the broadcast is meant to be
	// always-on, so the conservative fallback keeps it firing.
	coverHeartbeat := max(envDuration("STI_COVER_HEARTBEAT", 6*time.Hour), 0)
	// Window over which a republish batch's alias overwrites are spread (doc 18), so
	// an owner's shared cards do not all change at the same instant. The apply
	// granularity is the janitor tick (STI_JANITOR_INTERVAL, default 1 min): two of an
	// owner's ops jittered into the same tick apply in the same drain pass, i.e. the
	// same observable instant, which re-correlates them. So the window must span many
	// ticks to keep that same-tick collision rare: at the default 1 min tick, 20 min is
	// ~20 slots, so a given pair collides ~1/20. The cost is only staleness (a
	// just-changed public card can look stale to an existing link-holder for up to the
	// window); a positive result still reaches partners immediately over the separate
	// notify ping, so the badge-refresh delay is acceptable. Tunable via the env var.
	republishWindow := max(envDuration("STI_REPUBLISH_WINDOW", 20*time.Minute), 0)

	// Operator surface (doc 20). OFF by default so production ships dark. Turning it
	// on requires BOTH the flag AND a non-trivial bearer secret: if the flag is set
	// without a secret at least adminTokenMinLen long, refuse to boot rather than
	// expose admin with a weak or empty token (fail loud, like the decoy secret). A
	// secret set without the flag is inert; warn so the operator knows admin is off.
	adminEnabled, adminWarn, err := adminConfig(os.Getenv("STI_ADMIN_ENABLED") == "true", os.Getenv("STI_ADMIN_TOKEN"))
	if err != nil {
		log.Error("STI_ADMIN_ENABLED is set but STI_ADMIN_TOKEN is missing or too short",
			"min_len", adminTokenMinLen)
		os.Exit(1)
	}
	if adminWarn != "" {
		log.Warn(adminWarn)
	}
	adminToken := os.Getenv("STI_ADMIN_TOKEN")

	// Findable directory (doc 17). The post-release lock window defaults to 24h; a
	// short value lets a test exercise reclaim.
	vanityLock := max(envDuration("STI_VANITY_LOCK", 0), 0)
	// Global cap on GET /u resolve across all callers (doc 17), tunable for a busy
	// deployment. Zero leaves the server defaults (50/sec, burst 200).
	resolveRate := envFloat("STI_VANITY_RESOLVE_RATE", 0)
	resolveBurst := envFloat("STI_VANITY_RESOLVE_BURST", 0)
	// Global caps on the two public write-intake paths, bounding a distributed flood
	// of the report / knock tables. Zero leaves the server defaults (report 20/sec
	// burst 100; knock 50/sec burst 200).
	reportRate := envFloat("STI_REPORT_GLOBAL_RATE", 0)
	reportBurst := envFloat("STI_REPORT_GLOBAL_BURST", 0)
	knockGlobalRate := envFloat("STI_KNOCK_GLOBAL_RATE", 0)
	knockGlobalBurst := envFloat("STI_KNOCK_GLOBAL_BURST", 0)
	// The password-recovery envelope store (doc 32). The global caps bound a
	// distributed sweep of the (guessable) locator namespace; zero leaves the server
	// defaults (20/sec, burst 100).
	recoveryRate := envFloat("STI_RECOVERY_GLOBAL_RATE", 0)
	recoveryBurst := envFloat("STI_RECOVERY_GLOBAL_BURST", 0)

	// An admin-requested restart (POST /admin/restart) lands here: the same
	// graceful drain as a signal, then a deliberate non-zero exit so systemd's
	// Restart=on-failure brings the process back. Buffered + non-blocking so a
	// double click can't wedge the handler.
	restartCh := make(chan struct{}, 1)
	requestRestart := func() {
		select {
		case restartCh <- struct{}{}:
		default:
		}
	}

	srv := server.New(st, server.Config{
		DecoySecret:               secret,
		AllowedOrigins:            allowedOrigins,
		LogRing:                   ring,
		RequestRestart:            requestRestart,
		NotifyEnabled:             notifyEnabled,
		Sender:                    sender,
		VAPIDPublicKey:            vapidPublic,
		IPRatePerSec:              ipRate,
		IPBurst:                   ipBurst,
		MaxInflight:               maxInflight,
		SensitiveWait:             sensitiveWait,
		KnockTTL:                  knockTTL,
		CoverWindow:               coverWindow,
		CoverHeartbeat:            coverHeartbeat,
		RepublishWindow:           republishWindow,
		AdminEnabled:              adminEnabled,
		AdminToken:                adminToken,
		VanityLockWindow:          vanityLock,
		VanityResolveGlobalPerSec: resolveRate,
		VanityResolveGlobalBurst:  resolveBurst,
		ReportGlobalPerSec:        reportRate,
		ReportGlobalBurst:         reportBurst,
		KnockGlobalPerSec:         knockGlobalRate,
		KnockGlobalBurst:          knockGlobalBurst,
		RecoveryGlobalPerSec:      recoveryRate,
		RecoveryGlobalBurst:       recoveryBurst,
	}, log, nil)

	// Host and process health gauges. All system facts, no subject data.
	srv.Metrics().RegisterBuildInfo(buildVersion())
	srv.Metrics().RegisterRuntime()
	dbDir := filepath.Dir(dbPath)
	srv.Metrics().RegisterGaugeFunc("sti_disk_free_bytes",
		"Free bytes on the filesystem holding the database.",
		func() int64 { return diskFreeBytes(dbDir) })

	// Metrics persistence: keep the cumulative counters/histograms across restarts
	// instead of dropping to zero. Only enabled alongside the metrics listener, and
	// the file holds blind aggregates only (no per-request data). Empty disables it.
	metricsState := ""
	if metricsAddr != "" && metricsAddr != "off" {
		metricsState = env("STI_METRICS_STATE", filepath.Join(dbDir, "metrics.json"))
		if b, err := os.ReadFile(metricsState); err == nil {
			if err := srv.Metrics().Restore(b); err != nil {
				log.Error("metrics restore", "err", err)
			} else {
				log.Info("metrics restored", "path", metricsState)
			}
		}
	}

	// Janitor cadence. Default 1 minute; a short value lets a test observe knock
	// expiry without waiting a full minute. A non-positive value would panic
	// time.NewTicker, so fall back to the default.
	janitorInterval := envDuration("STI_JANITOR_INTERVAL", time.Minute)
	if janitorInterval <= 0 {
		janitorInterval = time.Minute
	}
	// Retention windows for the age-based sweeps. Defaults are deliberately
	// generous (storage reclamation, not policy): an expired link lingers a week
	// before deletion, an un-actionable orphan report a month, and an abandoned
	// account backup two years after its last read or write (disclosed in Privacy).
	ttls := janitorTTLs{
		aliasGrace:        envDuration("STI_ALIAS_PURGE_GRACE", 7*24*time.Hour),
		reportMaxAge:      envDuration("STI_REPORT_ORPHAN_MAX_AGE", 30*24*time.Hour),
		accountInactivity: envDuration("STI_ACCOUNT_INACTIVITY_TTL", 2*365*24*time.Hour),
		feedbackMaxAge:    envDuration("STI_FEEDBACK_MAX_AGE", 90*24*time.Hour),
	}
	go background(ctx, st, srv, metricsState, janitorInterval, ttls, log)

	httpSrv := &http.Server{
		Addr:              addr,
		Handler:           srv.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	go func() {
		log.Info("listening", "addr", addr, "db", dbPath)
		if err := httpSrv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Error("serve", "err", err)
			stop()
		}
	}()

	// Blind self-telemetry on a separate loopback listener. It exposes only
	// aggregate counters, gauges, and histograms (no id, IP, body, or token) and
	// must never be public.
	var metricsSrv *http.Server
	if metricsAddr != "" && metricsAddr != "off" {
		mux := http.NewServeMux()
		mux.Handle("GET /metrics", srv.Metrics().Handler())
		metricsSrv = &http.Server{Addr: metricsAddr, Handler: mux, ReadHeaderTimeout: 5 * time.Second}
		go func() {
			log.Info("metrics listening", "addr", metricsAddr)
			if err := metricsSrv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
				log.Error("metrics serve", "err", err)
			}
		}()
	}

	restart := false
	select {
	case <-ctx.Done():
		log.Info("shutting down")
	case <-restartCh:
		restart = true
		log.Info("restarting (admin requested)")
		stop() // stop the background loop like a signal would
	}
	saveMetrics(metricsState, srv, log) // final snapshot before exit
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = httpSrv.Shutdown(shutdownCtx)
	if metricsSrv != nil {
		_ = metricsSrv.Shutdown(shutdownCtx)
	}
	if restart {
		// The drain is done; exit non-zero on purpose (see restartExitCode).
		os.Exit(restartExitCode)
	}
}

// saveMetrics writes a blind-aggregate snapshot atomically (temp file + rename),
// so a crash mid-write never leaves a corrupt file. A no-op when path is empty.
func saveMetrics(path string, srv *server.Server, log *slog.Logger) {
	if path == "" {
		return
	}
	b, err := srv.Metrics().Snapshot()
	if err != nil {
		log.Error("metrics snapshot", "err", err)
		return
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, b, 0o600); err != nil {
		log.Error("metrics write", "err", err)
		return
	}
	if err := os.Rename(tmp, path); err != nil {
		log.Error("metrics rename", "err", err)
	}
}

// janitorTTLs holds the retention windows the age-based sweeps use. Zero or
// negative disables that sweep (the env reader keeps the defaults positive).
type janitorTTLs struct {
	aliasGrace        time.Duration // delete an alias this long after its link expired
	reportMaxAge      time.Duration // delete an orphan vanity report once this old
	accountInactivity time.Duration // delete an account backup unread/unwritten this long
	feedbackMaxAge    time.Duration // delete a "Something wrong?" report once this old (doc 35)
}

// background runs the periodic janitors: expire knocks, purge long-dead alias and
// orphan-report rows, drain due wakes, and trim idle rate-limit buckets. The send
// drain delivers contentless Web Push wakes via the server's Sender; intake is on by
// default (Config.NotifyEnabled), but with no Sender configured the drain reclaims
// queued wakes without delivering, so the queues stay bounded either way.
func background(ctx context.Context, st *store.Store, srv *server.Server, metricsState string, interval time.Duration, ttls janitorTTLs, log *slog.Logger) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			now := time.Now().UnixMilli()
			if n, err := st.PurgeExpiredKnocks(ctx, now); err != nil {
				srv.Metrics().Error(metrics.ErrJanitor)
				log.Error("purge knocks", "err", err)
			} else if n > 0 {
				log.Info("purged expired knocks", "count", n)
			}
			if ttls.aliasGrace > 0 {
				if n, err := st.PurgeExpiredAliases(ctx, now, ttls.aliasGrace.Milliseconds()); err != nil {
					srv.Metrics().Error(metrics.ErrJanitor)
					log.Error("purge aliases", "err", err)
				} else if n > 0 {
					log.Info("purged expired aliases", "count", n)
				}
			}
			if ttls.reportMaxAge > 0 {
				if n, err := st.PurgeOrphanVanityReports(ctx, now, ttls.reportMaxAge.Milliseconds()); err != nil {
					srv.Metrics().Error(metrics.ErrJanitor)
					log.Error("purge orphan reports", "err", err)
				} else if n > 0 {
					log.Info("purged orphan vanity reports", "count", n)
				}
			}
			if ttls.accountInactivity > 0 {
				if n, err := st.PurgeInactiveAccounts(ctx, now, ttls.accountInactivity.Milliseconds()); err != nil {
					srv.Metrics().Error(metrics.ErrJanitor)
					log.Error("purge inactive accounts", "err", err)
				} else if n > 0 {
					log.Info("purged inactive accounts", "count", n)
				}
			}
			if ttls.feedbackMaxAge > 0 {
				if n, err := st.PurgeFeedback(ctx, now, ttls.feedbackMaxAge.Milliseconds()); err != nil {
					srv.Metrics().Error(metrics.ErrJanitor)
					log.Error("purge feedback", "err", err)
				} else if n > 0 {
					log.Info("purged old feedback", "count", n)
				}
			}
			srv.DrainRepublishes(ctx, now)
			srv.DrainSends(ctx, now)
			srv.SweepLimiters(now)
			// Heartbeat: a stalled loop shows up as this gauge going stale.
			srv.Metrics().JanitorRan(now / 1000)
			// Persist the blind aggregates roughly once a minute, so a restart
			// continues the counters instead of resetting them to zero.
			saveMetrics(metricsState, srv, log)
		}
	}
}

// errAdminTokenFloor is returned by adminConfig when the admin surface is enabled
// with a missing or too-short bearer token.
var errAdminTokenFloor = errors.New("admin enabled but token shorter than the floor")

// adminConfig is the pure boot-time decision for the operator surface (doc 20).
// Enabling it requires BOTH the flag AND a non-trivial bearer secret: a flag set
// without a token at least adminTokenMinLen long is a fail-loud error (the caller
// refuses to boot, like the decoy secret). A token set without the flag is inert;
// warn carries a non-empty message so the operator knows admin stays off. Pure so
// the floor is unit-testable: weakening it turns the error-path test red.
func adminConfig(enabled bool, token string) (enabledOut bool, warn string, err error) {
	if enabled && len(token) < adminTokenMinLen {
		return false, "", errAdminTokenFloor
	}
	if !enabled && token != "" {
		return false, "STI_ADMIN_TOKEN is set but STI_ADMIN_ENABLED is off; the admin surface stays disabled", nil
	}
	return enabled, "", nil
}

// notifyGateWarning is the pure two-gate notify decision (doc 10 §F): delivery
// needs BOTH the flag (enabled) AND a configured Web Push sender (hasSender).
// Either alone delivers nothing, so it returns the matching warn string (empty
// when the two gates agree). Pure so the warn-path is unit-testable.
func notifyGateWarning(enabled, hasSender bool) string {
	switch {
	case enabled && !hasSender:
		return "STI_NOTIFY_ENABLED is set but no VAPID keys are configured; wakes are not delivered"
	case hasSender && !enabled:
		return "a Web Push sender is configured but STI_NOTIFY_ENABLED is off; delivery stays gated"
	default:
		return ""
	}
}

// decoySecret is the pure boot-time decode + floor for STI_DECOY_SECRET: it must
// be hex-encoded and decode to >= 32 bytes, fail loud otherwise. Pure so the floor
// is unit-testable without driving main().
func decoySecret(secretHex string) ([]byte, error) {
	if secretHex == "" {
		return nil, errors.New("required (hex, >= 32 bytes)")
	}
	secret, err := hex.DecodeString(secretHex)
	if err != nil || len(secret) < 32 {
		return nil, errors.New("must be hex-encoded and >= 32 bytes")
	}
	return secret, nil
}

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// envFloat reads a float env var, falling back to def when unset or unparseable.
func envFloat(key string, def float64) float64 {
	if v := os.Getenv(key); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			return f
		}
	}
	return def
}

// envInt reads an int env var, falling back to def when unset or unparseable.
func envInt(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}

// envDuration reads a Go duration env var (e.g. "200ms", "1s"), falling back to
// def when unset or unparseable.
func envDuration(key string, def time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			return d
		}
	}
	return def
}

// buildVersion returns a short build identifier from the embedded VCS info, or
// "unknown". It is a build fact, never anything about a subject.
func buildVersion() string {
	bi, ok := debug.ReadBuildInfo()
	if !ok {
		return "unknown"
	}
	for _, s := range bi.Settings {
		if s.Key == "vcs.revision" {
			if len(s.Value) > 12 {
				return s.Value[:12]
			}
			return s.Value
		}
	}
	return "unknown"
}

// diskFreeBytes reports free space on the filesystem at path (capacity signal for
// the flat VPS, where a full disk is a real failure mode). Returns 0 on error.
func diskFreeBytes(path string) int64 {
	var st syscall.Statfs_t
	if err := syscall.Statfs(path, &st); err != nil {
		return 0
	}
	return int64(uint64(st.Bavail) * uint64(st.Bsize))
}

// splitList parses a comma-separated env value into trimmed, non-empty items.
func splitList(v string) []string {
	var out []string
	for _, p := range strings.Split(v, ",") {
		if t := strings.TrimSpace(p); t != "" {
			out = append(out, t)
		}
	}
	return out
}

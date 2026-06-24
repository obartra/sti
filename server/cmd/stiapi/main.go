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

	"sti.care/api/internal/metrics"
	"sti.care/api/internal/server"
	"sti.care/api/internal/store"
)

// adminTokenMinLen is the boot-time length floor for STI_ADMIN_TOKEN when the
// admin surface is enabled (doc 20). 32 chars is comfortably above a guessable
// secret; the operator should use a long random value. Enforced loud at boot so a
// misconfigured deploy never exposes admin behind a weak token.
const adminTokenMinLen = 32

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))

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

	secretHex := os.Getenv("STI_DECOY_SECRET")
	if secretHex == "" {
		log.Error("STI_DECOY_SECRET is required (hex, >= 32 bytes)")
		os.Exit(1)
	}
	secret, err := hex.DecodeString(secretHex)
	if err != nil || len(secret) < 32 {
		log.Error("STI_DECOY_SECRET must be hex-encoded and >= 32 bytes")
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

	// Targeted-wake delivery (notify/push) is OFF by default and stays off in prod
	// until the cover-wake decorrelation fix lands (doc 10 §F). Two independent
	// gates must BOTH be on to deliver: STI_NOTIFY_ENABLED, and a configured Web
	// Push sender (VAPID keys). Either alone delivers nothing.
	notifyEnabled := os.Getenv("STI_NOTIFY_ENABLED") == "true"
	vapidPublic := os.Getenv("STI_VAPID_PUBLIC_KEY")
	var sender server.Sender
	if priv := os.Getenv("STI_VAPID_PRIVATE_KEY"); vapidPublic != "" && priv != "" {
		sender = server.NewWebPushSender(vapidPublic, priv, env("STI_VAPID_SUBJECT", "https://sti.care"))
	}
	if notifyEnabled && sender == nil {
		log.Warn("STI_NOTIFY_ENABLED is set but no VAPID keys are configured; wakes are not delivered")
	}
	if sender != nil && !notifyEnabled {
		log.Warn("a Web Push sender is configured but STI_NOTIFY_ENABLED is off; delivery stays gated")
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

	// Operator surface (doc 20). OFF by default so production ships dark. Turning it
	// on requires BOTH the flag AND a non-trivial bearer secret: if the flag is set
	// without a secret at least adminTokenMinLen long, refuse to boot rather than
	// expose admin with a weak or empty token (fail loud, like the decoy secret). A
	// secret set without the flag is inert; warn so the operator knows admin is off.
	adminEnabled := os.Getenv("STI_ADMIN_ENABLED") == "true"
	adminToken := os.Getenv("STI_ADMIN_TOKEN")
	if adminEnabled && len(adminToken) < adminTokenMinLen {
		log.Error("STI_ADMIN_ENABLED is set but STI_ADMIN_TOKEN is missing or too short",
			"min_len", adminTokenMinLen)
		os.Exit(1)
	}
	if !adminEnabled && adminToken != "" {
		log.Warn("STI_ADMIN_TOKEN is set but STI_ADMIN_ENABLED is off; the admin surface stays disabled")
	}

	// Findable directory writes (doc 17). OFF by default: GET /u resolve stays live
	// (and 404s the empty directory), but PUT/DELETE /u are not registered until the
	// launch gate flips this, so no name can be claimed pre-launch. The post-release
	// lock window defaults to 24h; a short value lets a test exercise reclaim.
	findableEnabled := os.Getenv("STI_FINDABLE_ENABLED") == "true"
	vanityLock := max(envDuration("STI_VANITY_LOCK", 0), 0)

	srv := server.New(st, server.Config{
		DecoySecret:      secret,
		AllowedOrigins:   allowedOrigins,
		NotifyEnabled:    notifyEnabled,
		Sender:           sender,
		VAPIDPublicKey:   vapidPublic,
		IPRatePerSec:     ipRate,
		IPBurst:          ipBurst,
		MaxInflight:      maxInflight,
		SensitiveWait:    sensitiveWait,
		KnockTTL:         knockTTL,
		CoverWindow:      coverWindow,
		AdminEnabled:     adminEnabled,
		AdminToken:       adminToken,
		FindableEnabled:  findableEnabled,
		VanityLockWindow: vanityLock,
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
	go background(ctx, st, srv, metricsState, janitorInterval, log)

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

	<-ctx.Done()
	log.Info("shutting down")
	saveMetrics(metricsState, srv, log) // final snapshot before exit
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = httpSrv.Shutdown(shutdownCtx)
	if metricsSrv != nil {
		_ = metricsSrv.Shutdown(shutdownCtx)
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

// background runs the periodic janitors: expire knocks, drain due wakes, and trim
// idle rate-limit buckets. The send drain delivers contentless Web Push wakes via
// the server's Sender, gated off by default (Config.NotifyEnabled), so it is inert
// until targeted-wake delivery is explicitly enabled.
func background(ctx context.Context, st *store.Store, srv *server.Server, metricsState string, interval time.Duration, log *slog.Logger) {
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

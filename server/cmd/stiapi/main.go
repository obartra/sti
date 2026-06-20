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
	"strings"
	"syscall"
	"time"

	"sti.care/api/internal/metrics"
	"sti.care/api/internal/server"
	"sti.care/api/internal/store"
)

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
	// until the cover-wake decorrelation fix lands (doc 10 §F). No Web Push sender
	// is wired here yet, so enabling the gate alone still delivers nothing; the
	// flag exists so the drain + queue mechanics can run once a Sender is provided.
	notifyEnabled := os.Getenv("STI_NOTIFY_ENABLED") == "true"
	if notifyEnabled {
		log.Warn("STI_NOTIFY_ENABLED is set but no Web Push sender is configured; wakes are not delivered")
	}

	srv := server.New(st, server.Config{
		DecoySecret:    secret,
		AllowedOrigins: allowedOrigins,
		NotifyEnabled:  notifyEnabled,
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

	go background(ctx, st, srv, metricsState, log)

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
func background(ctx context.Context, st *store.Store, srv *server.Server, metricsState string, log *slog.Logger) {
	ticker := time.NewTicker(time.Minute)
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

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
	"strings"
	"syscall"
	"time"

	"sti.care/api/internal/server"
	"sti.care/api/internal/store"
)

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))

	addr := env("STI_ADDR", ":8080")
	dbPath := env("STI_DB_PATH", "sti.db")

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

	srv := server.New(st, server.Config{DecoySecret: secret, AllowedOrigins: allowedOrigins}, log, nil)

	go background(ctx, st, srv, log)

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

	<-ctx.Done()
	log.Info("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = httpSrv.Shutdown(shutdownCtx)
}

// background runs the periodic janitors: expire knocks, drain due wakes, and trim
// idle rate-limit buckets. The send drain currently just clears the queue (real
// Web Push delivery is wired when client subscriptions exist); it proves the
// queue mechanics end to end.
func background(ctx context.Context, st *store.Store, srv *server.Server, log *slog.Logger) {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			now := time.Now().UnixMilli()
			if n, err := st.PurgeExpiredKnocks(ctx, now); err != nil {
				log.Error("purge knocks", "err", err)
			} else if n > 0 {
				log.Info("purged expired knocks", "count", n)
			}
			drainSends(ctx, st, now, log)
			srv.SweepLimiters(now)
		}
	}
}

func drainSends(ctx context.Context, st *store.Store, now int64, log *slog.Logger) {
	sends, err := st.DueSends(ctx, now, 256)
	if err != nil {
		log.Error("due sends", "err", err)
		return
	}
	for _, s := range sends {
		// TODO(push): deliver a contentless Web Push wake here once subscriptions exist.
		if err := st.DeleteSend(ctx, s.ID); err != nil {
			log.Error("delete send", "err", err)
		}
	}
}

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
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

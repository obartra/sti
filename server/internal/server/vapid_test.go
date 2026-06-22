package server

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"sti.care/api/internal/contract"
	"sti.care/api/internal/store"
)

func vapidServer(t *testing.T, publicKey string) http.Handler {
	t.Helper()
	st, err := store.Open(context.Background(), filepath.Join(t.TempDir(), "t.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	secret := make([]byte, 32)
	for i := range secret {
		secret[i] = byte(i + 1)
	}
	cfg := Config{DecoySecret: secret, VAPIDPublicKey: publicKey}
	srv := New(st, cfg, slog.New(slog.NewTextHandler(io.Discard, nil)), nil)
	return srv.Handler()
}

func getVapid(t *testing.T, h http.Handler) contract.VapidResponse {
	t.Helper()
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", contract.PathVapid, nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("GET /vapid = %d, want 200", rec.Code)
	}
	var out contract.VapidResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("decode: %v", err)
	}
	return out
}

func TestVapidServesConfiguredKey(t *testing.T) {
	got := getVapid(t, vapidServer(t, "BPexamplePublicKey123"))
	if got.PublicKey != "BPexamplePublicKey123" {
		t.Fatalf("publicKey = %q, want the configured key", got.PublicKey)
	}
}

func TestVapidEmptyWhenUnconfigured(t *testing.T) {
	// No VAPID key set: the endpoint still answers 200 with an empty key, which the
	// client reads as "push unavailable" (never an error, never a leak).
	got := getVapid(t, vapidServer(t, ""))
	if got.PublicKey != "" {
		t.Fatalf("publicKey = %q, want empty when unconfigured", got.PublicKey)
	}
}

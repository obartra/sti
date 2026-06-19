package server

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"sti.care/api/internal/contract"
	"sti.care/api/internal/store"
)

const allowedOrigin = "https://sti.care"

func newTestServerWithOrigins(t *testing.T, origins ...string) http.Handler {
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
	srv := New(
		st,
		Config{DecoySecret: secret, AllowedOrigins: origins},
		slog.New(slog.NewTextHandler(io.Discard, nil)),
		nil,
	)
	return srv.Handler()
}

func TestCORSPreflightFromAllowedOrigin(t *testing.T) {
	h := newTestServerWithOrigins(t, allowedOrigin)
	req := httptest.NewRequest("OPTIONS", contract.PathAliasPrefix+randID(t), nil)
	req.Header.Set("Origin", allowedOrigin)
	req.Header.Set("Access-Control-Request-Method", "PUT")
	rec := do(h, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("preflight status: %d", rec.Code)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != allowedOrigin {
		t.Fatalf("allow-origin: %q", got)
	}
	if got := rec.Header().Get("Access-Control-Expose-Headers"); got != contract.HeaderVersion {
		t.Fatalf("expose-headers: %q (the client must read %s)", got, contract.HeaderVersion)
	}
	if h := rec.Header().Get("Access-Control-Allow-Headers"); !strings.Contains(h, contract.HeaderWriteToken) {
		t.Fatalf("allow-headers missing write token: %q", h)
	}
}

func TestCORSDisallowedOriginGetsNoAllowHeaders(t *testing.T) {
	h := newTestServerWithOrigins(t, allowedOrigin)
	req := httptest.NewRequest("OPTIONS", contract.PathNotify, nil)
	req.Header.Set("Origin", "https://evil.example")
	rec := do(h, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("status: %d", rec.Code)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("allow-origin leaked to a disallowed origin: %q", got)
	}
}

// CORS controls who may READ the response in a browser; it must not change the
// existence-uniform body of GET /a (same status, same fixed size).
func TestCORSSimpleGetEchoesOriginAndStaysUniform(t *testing.T) {
	h := newTestServerWithOrigins(t, allowedOrigin)
	req := httptest.NewRequest("GET", contract.PathAliasPrefix+randID(t), nil)
	req.Header.Set("Origin", allowedOrigin)
	rec := do(h, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: %d", rec.Code)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != allowedOrigin {
		t.Fatalf("allow-origin: %q", got)
	}
	if n := len(rec.Body.Bytes()); n != contract.AliasPayloadSize {
		t.Fatalf("alias body size %d, want %d", n, contract.AliasPayloadSize)
	}
}

func TestCORSNoOriginIsUntouched(t *testing.T) {
	h := newTestServerWithOrigins(t, allowedOrigin)
	rec := do(h, httptest.NewRequest("GET", contract.PathHealth, nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("status: %d", rec.Code)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("allow-origin set with no Origin header: %q", got)
	}
}

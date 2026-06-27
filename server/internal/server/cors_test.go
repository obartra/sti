package server

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"sti.care/api/internal/contract"
)

const allowedOrigin = "https://sti.care"

func newTestServerWithOrigins(t *testing.T, origins ...string) http.Handler {
	t.Helper()
	srv, _ := newServer(t, Config{AllowedOrigins: origins}, nil)
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
	allowHeaders := rec.Header().Get("Access-Control-Allow-Headers")
	if !strings.Contains(allowHeaders, contract.HeaderWriteToken) {
		t.Fatalf("allow-headers missing write token: %q", allowHeaders)
	}
	// The alias PUT carries X-Expires-At (doc 16); without it the browser preflight
	// blocks every link write. Browser-only, so pin it here (CORS isn't exercised
	// by the Node integration suite).
	if !strings.Contains(allowHeaders, contract.HeaderExpiresAt) {
		t.Fatalf("allow-headers missing %s: %q", contract.HeaderExpiresAt, allowHeaders)
	}
	// The admin bearer rides Authorization (doc 20); same browser-only requirement.
	if !strings.Contains(allowHeaders, "Authorization") {
		t.Fatalf("allow-headers missing Authorization: %q", allowHeaders)
	}
}

// Every HTTP method the browser client actually issues must be in the preflight
// Allow-Methods, or the browser blocks the call before it is sent. DELETE is the
// easy one to forget: it rides the Findable release (DELETE /u/{name}) and the
// account-sync delete (DELETE /acct/{id}), and is never CORS-simple. Pin the full
// set here because the Node integration suite does not exercise CORS.
func TestCORSAllowsEveryClientMethod(t *testing.T) {
	h := newTestServerWithOrigins(t, allowedOrigin)
	req := httptest.NewRequest("OPTIONS", contract.PathAliasPrefix+randID(t), nil)
	req.Header.Set("Origin", allowedOrigin)
	req.Header.Set("Access-Control-Request-Method", "DELETE")
	rec := do(h, req)

	allow := rec.Header().Get("Access-Control-Allow-Methods")
	for _, m := range []string{"GET", "PUT", "POST", "DELETE"} {
		if !strings.Contains(allow, m) {
			t.Fatalf("allow-methods %q missing %s (the client issues it)", allow, m)
		}
	}
}

func TestCORSDisallowedOriginGetsNoAllowHeaders(t *testing.T) {
	h := newTestServerWithOrigins(t, allowedOrigin)
	req := httptest.NewRequest("OPTIONS", contract.PathNotify, nil)
	req.Header.Set("Origin", "https://evil.example")
	req.Header.Set("Access-Control-Request-Method", "POST")
	rec := do(h, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("status: %d", rec.Code)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("allow-origin leaked to a disallowed origin: %q", got)
	}
}

// A bare OPTIONS (no Access-Control-Request-Method) is not a preflight, so it is
// not short-circuited: it falls through to the mux under the normal shedding
// path rather than riding an un-shed shortcut.
func TestCORSBareOptionsFallsThrough(t *testing.T) {
	h := newTestServerWithOrigins(t, allowedOrigin)
	req := httptest.NewRequest("OPTIONS", contract.PathNotify, nil)
	req.Header.Set("Origin", allowedOrigin)
	rec := do(h, req)

	if rec.Code == http.StatusNoContent {
		t.Fatalf("bare OPTIONS was short-circuited to 204; expected a fall-through")
	}
	// Still carries the Vary: Origin signal even when not a preflight.
	if got := rec.Header().Get("Vary"); got != "Origin" {
		t.Fatalf("Vary: %q, want Origin", got)
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

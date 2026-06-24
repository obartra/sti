package server

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"sti.care/api/internal/contract"
	"sti.care/api/internal/store"
)

// newFindableServer builds a server with the Findable WRITE endpoints enabled and
// a short post-release lock so reclaim-after-lock is testable. It returns the
// handler, the store, and the injectable clock so tests can advance past the lock.
func newFindableServer(t *testing.T, lock time.Duration) (http.Handler, *store.Store, *int64) {
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
	clock := int64(1_000_000)
	srv := New(st, Config{
		DecoySecret:      secret,
		FindableEnabled:  true,
		VanityLockWindow: lock,
	}, slog.New(slog.NewTextHandler(io.Discard, nil)), func() int64 { return clock })
	return srv.Handler(), st, &clock
}

// publishAlias creates an alias owned by `token`, so a vanity registration that
// points at it can prove ownership.
func publishAlias(t *testing.T, h http.Handler, token string) string {
	t.Helper()
	id := randID(t)
	put := httptest.NewRequest("PUT", contract.PathAliasPrefix+id,
		bytes.NewReader(bytes.Repeat([]byte{0xAB}, contract.AliasPayloadSize)))
	put.Header.Set(contract.HeaderWriteToken, token)
	if rec := do(h, put); rec.Code != http.StatusNoContent {
		t.Fatalf("publish alias: %d", rec.Code)
	}
	return id
}

func registerName(h http.Handler, name, aliasID, token string) *httptest.ResponseRecorder {
	body, _ := json.Marshal(contract.VanityRegisterRequest{AliasID: aliasID})
	req := httptest.NewRequest("PUT", contract.PathVanityPrefix+name, bytes.NewReader(body))
	if token != "" {
		req.Header.Set(contract.HeaderWriteToken, token)
	}
	return do(h, req)
}

func resolveName(h http.Handler, name string) *httptest.ResponseRecorder {
	return do(h, httptest.NewRequest("GET", contract.PathVanityPrefix+name, nil))
}

// The happy path: an owner registers a name for their alias, and it resolves to
// that alias id; the name is normalized (uppercase request resolves the same).
func TestVanityRegisterThenResolve(t *testing.T) {
	h, _, _ := newFindableServer(t, time.Hour)
	alias := publishAlias(t, h, "owner-token")

	if rec := registerName(h, "robin", alias, "owner-token"); rec.Code != http.StatusNoContent {
		t.Fatalf("register: %d", rec.Code)
	}
	rec := resolveName(h, "ROBIN") // normalized before lookup
	if rec.Code != http.StatusOK {
		t.Fatalf("resolve: %d", rec.Code)
	}
	var resp contract.VanityResolveResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil || resp.AliasID != alias {
		t.Fatalf("resolve body: %q (err %v), want %s", resp.AliasID, err, alias)
	}
}

// Registration requires proving ownership of the target alias: a missing or wrong
// write token is rejected, and the name is never claimed.
func TestVanityRegisterRequiresAliasOwnership(t *testing.T) {
	h, _, _ := newFindableServer(t, time.Hour)
	alias := publishAlias(t, h, "owner-token")

	if rec := registerName(h, "robin", alias, ""); rec.Code != http.StatusBadRequest {
		t.Fatalf("no token: %d, want 400", rec.Code)
	}
	if rec := registerName(h, "robin", alias, "not-the-owner"); rec.Code != http.StatusForbidden {
		t.Fatalf("wrong token: %d, want 403", rec.Code)
	}
	// Nothing was claimed.
	if rec := resolveName(h, "robin"); rec.Code != http.StatusNotFound {
		t.Fatalf("resolve after failed register: %d, want 404", rec.Code)
	}
}

// Malformed names are 400; reserved and blocklisted names are 409 (never claimable).
func TestVanityRegisterNameRules(t *testing.T) {
	h, _, _ := newFindableServer(t, time.Hour)
	alias := publishAlias(t, h, "owner-token")

	if rec := registerName(h, "ab", alias, "owner-token"); rec.Code != http.StatusBadRequest {
		t.Fatalf("too short: %d, want 400", rec.Code)
	}
	if rec := registerName(h, "rob-in", alias, "owner-token"); rec.Code != http.StatusBadRequest {
		t.Fatalf("bad charset: %d, want 400", rec.Code)
	}
	if rec := registerName(h, "admin", alias, "owner-token"); rec.Code != http.StatusConflict {
		t.Fatalf("reserved: %d, want 409", rec.Code)
	}
}

// First-come: a name held by one alias cannot be taken by another (409), but the
// holder re-registering the same name is idempotent (204).
func TestVanityRegisterFirstComeAndIdempotent(t *testing.T) {
	h, _, _ := newFindableServer(t, time.Hour)
	mine := publishAlias(t, h, "me")
	theirs := publishAlias(t, h, "them")

	if rec := registerName(h, "robin", mine, "me"); rec.Code != http.StatusNoContent {
		t.Fatalf("first claim: %d", rec.Code)
	}
	if rec := registerName(h, "robin", theirs, "them"); rec.Code != http.StatusConflict {
		t.Fatalf("claim by other: %d, want 409", rec.Code)
	}
	if rec := registerName(h, "robin", mine, "me"); rec.Code != http.StatusNoContent {
		t.Fatalf("idempotent re-claim: %d, want 204", rec.Code)
	}
	if rec := resolveName(h, "robin"); rec.Code != http.StatusOK {
		t.Fatalf("still resolves: %d", rec.Code)
	}
}

// Release (owner-only) frees the name into the lock: it stops resolving, stays
// unclaimable by anyone during the lock, then is reclaimable after it lapses.
func TestVanityReleaseAndLock(t *testing.T) {
	const lock = time.Hour
	h, _, clock := newFindableServer(t, lock)
	mine := publishAlias(t, h, "me")
	theirs := publishAlias(t, h, "them")

	if rec := registerName(h, "robin", mine, "me"); rec.Code != http.StatusNoContent {
		t.Fatalf("claim: %d", rec.Code)
	}

	// A non-owner cannot release it.
	rel := func(token string) *httptest.ResponseRecorder {
		req := httptest.NewRequest("DELETE", contract.PathVanityPrefix+"robin", nil)
		if token != "" {
			req.Header.Set(contract.HeaderWriteToken, token)
		}
		return do(h, req)
	}
	if rec := rel("them"); rec.Code != http.StatusForbidden {
		t.Fatalf("release by non-owner: %d, want 403", rec.Code)
	}
	// The owner releases it.
	if rec := rel("me"); rec.Code != http.StatusNoContent {
		t.Fatalf("owner release: %d", rec.Code)
	}
	if rec := resolveName(h, "robin"); rec.Code != http.StatusNotFound {
		t.Fatalf("after release resolves: %d, want 404", rec.Code)
	}
	// Releasing again is a 404 (nothing active to release).
	if rec := rel("me"); rec.Code != http.StatusNotFound {
		t.Fatalf("re-release: %d, want 404", rec.Code)
	}
	// During the lock, even a fresh claim by someone else is rejected.
	if rec := registerName(h, "robin", theirs, "them"); rec.Code != http.StatusConflict {
		t.Fatalf("claim during lock: %d, want 409", rec.Code)
	}
	// Advance past the lock: now reclaimable first-come.
	*clock += lock.Milliseconds()
	if rec := registerName(h, "robin", theirs, "them"); rec.Code != http.StatusNoContent {
		t.Fatalf("reclaim after lock: %d, want 204", rec.Code)
	}
	if rec := resolveName(h, "robin"); rec.Code != http.StatusOK {
		t.Fatalf("resolves after reclaim: %d", rec.Code)
	}
}

// With Findable disabled (the default), the write endpoints are not registered.
// Since GET /u/{name} IS always present (a public resource), a PUT/DELETE to it
// is a 405 method-not-allowed (not a 404) — which leaks nothing the public GET
// doesn't already, and no name can be claimed. Resolve stays live.
func TestVanityWritesGatedOffByDefault(t *testing.T) {
	h := newTestServer(t) // Findable disabled
	alias := publishAlias(t, h, "owner-token")

	if rec := registerName(h, "robin", alias, "owner-token"); rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("register while gated off: %d, want 405", rec.Code)
	}
	del := httptest.NewRequest("DELETE", contract.PathVanityPrefix+"robin", nil)
	del.Header.Set(contract.HeaderWriteToken, "owner-token")
	if rec := do(h, del); rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("release while gated off: %d, want 405", rec.Code)
	}
	// Resolve still works (and 404s the empty directory).
	if rec := resolveName(h, "robin"); rec.Code != http.StatusNotFound {
		t.Fatalf("resolve while gated off: %d, want 404", rec.Code)
	}
}

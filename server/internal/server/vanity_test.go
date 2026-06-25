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
// Releasing a name clears its reports (they were about that registration, and the
// review queue hides post-release names anyway, so clearing keeps the table tidy).
func TestVanityReleaseClearsReports(t *testing.T) {
	h, st, _ := newFindableServer(t, time.Hour)
	ctx := context.Background()
	mine := publishAlias(t, h, "me")

	if rec := registerName(h, "robin", mine, "me"); rec.Code != http.StatusNoContent {
		t.Fatalf("claim: %d", rec.Code)
	}
	if rec := reportName(h, "robin", contract.ReportAbuse); rec.Code != http.StatusAccepted {
		t.Fatalf("report: %d", rec.Code)
	}
	// While registered, the report is actionable in the queue.
	if got, _ := st.PendingVanityReports(ctx, 10); len(got) != 1 || got[0].Name != "robin" {
		t.Fatalf("queue before release: %+v", got)
	}

	req := httptest.NewRequest("DELETE", contract.PathVanityPrefix+"robin", nil)
	req.Header.Set(contract.HeaderWriteToken, "me")
	if rec := do(h, req); rec.Code != http.StatusNoContent {
		t.Fatalf("release: %d", rec.Code)
	}
	// The reports are gone from the table, not merely hidden.
	if got, _ := st.PendingVanityReports(ctx, 10); len(got) != 0 {
		t.Fatalf("queue after release: %+v", got)
	}
}

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

func reportName(h http.Handler, name, reason string) *httptest.ResponseRecorder {
	body, _ := json.Marshal(contract.VanityReportRequest{Reason: reason})
	return do(h, httptest.NewRequest("POST", contract.PathVanityPrefix+name+"/report", bytes.NewReader(body)))
}

// A well-formed report is accepted (202) and recorded; an unknown reason is 400.
func TestVanityReportIntake(t *testing.T) {
	h, st, _ := newFindableServer(t, time.Hour)
	ctx := context.Background()
	// The queue only surfaces registered names, so register the target first.
	alias := publishAlias(t, h, "owner")
	if _, err := st.ClaimVanityName(ctx, "robin", alias, 1); err != nil {
		t.Fatal(err)
	}

	if rec := reportName(h, "robin", contract.ReportImpersonation); rec.Code != http.StatusAccepted {
		t.Fatalf("report: %d, want 202", rec.Code)
	}
	if got, _ := st.PendingVanityReports(ctx, 10); len(got) != 1 || got[0].Name != "robin" {
		t.Fatalf("report not recorded: %+v", got)
	}
	if rec := reportName(h, "robin", "nonsense"); rec.Code != http.StatusBadRequest {
		t.Fatalf("bad reason: %d, want 400", rec.Code)
	}
}

// Reporting a name that matches an objective rule (reserved/blocklisted) auto-takes
// it down hands-free and clears the reports; volume is never needed. This is the
// "a name became disallowed after the list grew" path (registration blocks such
// names up front, so they only arrive here via the directly-seeded case).
func TestVanityReportAutoTakedownOnRuleMatch(t *testing.T) {
	h, st, _ := newFindableServer(t, time.Hour)
	ctx := context.Background()
	alias := publishAlias(t, h, "owner")
	if _, err := st.ClaimVanityName(ctx, "admin", alias, 1); err != nil { // reserved; seeded directly
		t.Fatal(err)
	}
	if _, found, _ := st.ResolveVanityName(ctx, "admin"); !found {
		t.Fatal("seed: admin should resolve")
	}

	if rec := reportName(h, "admin", contract.ReportImpersonation); rec.Code != http.StatusAccepted {
		t.Fatalf("report: %d", rec.Code)
	}
	if _, found, _ := st.ResolveVanityName(ctx, "admin"); found {
		t.Fatal("auto-takedown: admin should no longer resolve")
	}
	if got, _ := st.PendingVanityReports(ctx, 10); len(got) != 0 {
		t.Fatalf("auto-actioned reports not cleared: %+v", got)
	}
	// The hands-free takedown is recorded so it stays reconstructable.
	if a, _ := st.RecentAudits(ctx, 10); len(a) == 0 || a[0].Action != "vanity.takedown.auto" || a[0].Target != "admin" {
		t.Fatalf("auto-takedown not audited: %+v", a)
	}
}

// With Findable disabled, /u/{name}/report is not registered at all (no GET on
// that path either), so it is a bare 404.
func TestVanityReportGatedOff(t *testing.T) {
	h := newTestServer(t)
	if rec := reportName(h, "robin", contract.ReportSpam); rec.Code != http.StatusNotFound {
		t.Fatalf("report while gated off: %d, want 404", rec.Code)
	}
}

// The global resolve cap (doc 17) sheds bulk enumeration across ALL callers, not
// just per IP: with a tiny global budget, distinct client IPs still share the one
// bucket, so the (burst+1)th resolve is a 429 regardless of who sends it. A frozen
// clock keeps the bucket from refilling mid-test.
func TestVanityResolveGlobalRateLimit(t *testing.T) {
	st, err := store.Open(context.Background(), filepath.Join(t.TempDir(), "t.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	srv := New(st, Config{
		DecoySecret: make([]byte, 32),
		// Generous per-IP so it never trips first; tiny global so the cap is the global one.
		IPRatePerSec:              1000,
		IPBurst:                   1000,
		VanityResolveGlobalPerSec: 0.000001,
		VanityResolveGlobalBurst:  2,
	}, slog.New(slog.NewTextHandler(io.Discard, nil)), func() int64 { return 1000 })
	h := srv.Handler()

	get := func(ip string) int {
		req := httptest.NewRequest("GET", contract.PathVanityPrefix+"nobody", nil)
		req.Header.Set("X-Real-IP", ip) // a DIFFERENT IP each call
		return do(h, req).Code
	}
	// Two resolves drain the global burst (each a 404 miss, but allowed);
	if c := get("1.1.1.1"); c != http.StatusNotFound {
		t.Fatalf("resolve 1: %d, want 404", c)
	}
	if c := get("2.2.2.2"); c != http.StatusNotFound {
		t.Fatalf("resolve 2: %d, want 404", c)
	}
	// the third, from yet another IP, is shed by the shared global bucket.
	if c := get("3.3.3.3"); c != http.StatusTooManyRequests {
		t.Fatalf("resolve 3 (different IP): %d, want 429", c)
	}
}

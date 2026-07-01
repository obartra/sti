package server

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"sti.care/api/internal/contract"
	"sti.care/api/internal/store"
)

const testAdminToken = "test-admin-secret-0123456789abcdef" // >= boot floor, but server.New imposes none

// newTestAdminSrv builds a *Server with the operator surface enabled, plus its
// store. Tests that only need the handler use newTestAdminServer; this variant
// hands back the Server so a test can swap a seam (e.g. the audit appender).
func newTestAdminSrv(t *testing.T, token string) (*Server, *store.Store) {
	t.Helper()
	// A generous burst so the auth/audit assertions (which fire several requests
	// back to back) are never throttled; TestAdminRateLimited pins the tight budget.
	return newServer(t, Config{
		AdminEnabled: true,
		AdminToken:   token,
		AdminBurst:   1000,
	}, nil)
}

// newTestAdminServer builds a server with the operator surface enabled and returns
// the handler plus the store, so a test can assert on the audit log it writes.
func newTestAdminServer(t *testing.T, token string) (http.Handler, *store.Store) {
	t.Helper()
	srv, st := newTestAdminSrv(t, token)
	return srv.Handler(), st
}

func adminPing(h http.Handler, bearer string) *httptest.ResponseRecorder {
	req := httptest.NewRequest("GET", contract.PathAdminPing, nil)
	if bearer != "" {
		req.Header.Set("Authorization", bearer)
	}
	return do(h, req)
}

// The ping gate: the correct bearer is 204, and everything else (no header, a
// non-Bearer scheme, a wrong token, and tokens whose LENGTH differs from the
// secret) is a uniform 401. The length cases matter because a naive
// ConstantTimeCompare short-circuits on a length mismatch; the handler hashes both
// sides first so a wrong-length guess is rejected the same way as a wrong-value one.
func TestAdminPingTokenGate(t *testing.T) {
	h, _ := newTestAdminServer(t, testAdminToken)

	if rec := adminPing(h, "Bearer "+testAdminToken); rec.Code != http.StatusNoContent {
		t.Fatalf("valid token: got %d, want 204", rec.Code)
	}

	for name, bearer := range map[string]string{
		"no header":      "",
		"wrong scheme":   "Basic " + testAdminToken,
		"bare token":     testAdminToken,
		"wrong value":    "Bearer " + strings.Repeat("x", len(testAdminToken)),
		"shorter prefix": "Bearer " + testAdminToken[:len(testAdminToken)-3],
		"longer":         "Bearer " + testAdminToken + "extra",
		"empty bearer":   "Bearer ",
	} {
		rec := adminPing(h, bearer)
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("%s: got %d, want 401", name, rec.Code)
		}
		var resp contract.ErrorResponse
		if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil || resp.Error.Code != contract.ErrUnauthorized {
			t.Fatalf("%s: error code = %q (err %v), want %q", name, resp.Error.Code, err, contract.ErrUnauthorized)
		}
	}
}

// When the admin surface is disabled (the default), no route is registered, so
// /admin/ping is a bare 404 even with a would-be-valid token: the surface is
// invisible, not merely guarded.
func TestAdminDisabledIsNotFound(t *testing.T) {
	h := newTestServer(t) // admin off by default
	if rec := adminPing(h, "Bearer "+testAdminToken); rec.Code != http.StatusNotFound {
		t.Fatalf("admin disabled: got %d, want 404", rec.Code)
	}
}

// An enabled surface with an empty configured token never authorizes, even with a
// "Bearer " header (defense in depth; boot refuses this config, but the auth check
// must not depend on that).
func TestAdminEmptyTokenNeverAuthorizes(t *testing.T) {
	h, _ := newTestAdminServer(t, "")
	for _, bearer := range []string{"Bearer ", "Bearer anything", ""} {
		if rec := adminPing(h, bearer); rec.Code != http.StatusUnauthorized {
			t.Fatalf("empty configured token, bearer %q: got %d, want 401", bearer, rec.Code)
		}
	}
}

// A successful ping writes exactly one audit row (action "ping", no target); a
// failed auth writes none, so an attacker cannot flood the log with 401s.
func TestAdminPingAuditing(t *testing.T) {
	h, st := newTestAdminServer(t, testAdminToken)
	ctx := context.Background()

	// Three rejected attempts leave the log empty.
	adminPing(h, "")
	adminPing(h, "Bearer wrong")
	adminPing(h, "Basic "+testAdminToken)
	if got, err := st.RecentAudits(ctx, 0, 10); err != nil || len(got) != 0 {
		t.Fatalf("after failed auths: %d rows (err %v), want 0", len(got), err)
	}

	if rec := adminPing(h, "Bearer "+testAdminToken); rec.Code != http.StatusNoContent {
		t.Fatalf("valid ping: %d", rec.Code)
	}
	got, err := st.RecentAudits(ctx, 0, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].Action != "ping" || got[0].Target != "" {
		t.Fatalf("audit rows = %+v, want one ping with empty target", got)
	}
}

// The /admin limiter sheds an over-budget caller with a 429 BEFORE the bearer
// check, so an unauthenticated flood is cheap and cannot brute-force at speed. A
// frozen clock keeps the bucket from refilling mid-test.
func TestAdminRateLimited(t *testing.T) {
	st, err := store.Open(context.Background(), filepath.Join(t.TempDir(), "t.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	clock := func() int64 { return 1000 }
	srv := New(st, Config{
		DecoySecret:     make([]byte, 32),
		AdminEnabled:    true,
		AdminToken:      testAdminToken,
		AdminRatePerSec: 0.000001, // effectively no refill within the test
		AdminBurst:      2,
	}, slog.New(slog.NewTextHandler(io.Discard, nil)), clock)
	h := srv.Handler()

	// Burst of 2 valid pings succeed; the 3rd is throttled even though its token is
	// correct, proving the limit runs ahead of (and independent of) auth.
	if rec := adminPing(h, "Bearer "+testAdminToken); rec.Code != http.StatusNoContent {
		t.Fatalf("ping 1: %d", rec.Code)
	}
	if rec := adminPing(h, "Bearer "+testAdminToken); rec.Code != http.StatusNoContent {
		t.Fatalf("ping 2: %d", rec.Code)
	}
	if rec := adminPing(h, "Bearer "+testAdminToken); rec.Code != http.StatusTooManyRequests {
		t.Fatalf("ping 3: got %d, want 429", rec.Code)
	}
}

// The admin bearer is cross-origin (the /admin page on the app origin calls the
// api origin), so a preflight from an allowed origin must list Authorization in
// Access-Control-Allow-Headers, or the browser blocks the request before it is
// sent. Browser-only, so it is pinned here (the integration suite skips CORS).
func TestAdminCORSAllowsAuthorization(t *testing.T) {
	h := newTestServerWithOrigins(t, allowedOrigin)
	req := httptest.NewRequest("OPTIONS", contract.PathAdminPing, nil)
	req.Header.Set("Origin", allowedOrigin)
	req.Header.Set("Access-Control-Request-Method", "GET")
	req.Header.Set("Access-Control-Request-Headers", "authorization")
	rec := do(h, req)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("preflight: %d", rec.Code)
	}
	if got := rec.Header().Get("Access-Control-Allow-Headers"); !strings.Contains(strings.ToLower(got), "authorization") {
		t.Fatalf("allow-headers missing Authorization: %q", got)
	}
}

// GET /admin/audit returns recent admin actions newest-first (doc 20 A4), authed
// only, and is itself a read (writes no audit row).
func TestAdminAudit(t *testing.T) {
	h, st := newTestAdminServer(t, testAdminToken)
	ctx := context.Background()

	if err := st.AppendAudit(ctx, "vanity.takedown", "robin", 100); err != nil {
		t.Fatal(err)
	}
	if err := st.AppendAudit(ctx, "account.disable", "acc1", 200); err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest("GET", contract.PathAdminAudit, nil)
	req.Header.Set("Authorization", "Bearer "+testAdminToken)
	rec := do(h, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("audit: %d", rec.Code)
	}
	var resp contract.AdminAuditResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	// Newest first: account.disable (id 2) before vanity.takedown (id 1).
	if len(resp.Entries) != 2 {
		t.Fatalf("entries = %d, want 2", len(resp.Entries))
	}
	if resp.Entries[0].Action != "account.disable" || resp.Entries[0].Target != "acc1" || resp.Entries[0].CreatedAt != 200 {
		t.Fatalf("entry0 = %+v", resp.Entries[0])
	}
	if resp.Entries[1].Action != "vanity.takedown" || resp.Entries[1].Target != "robin" {
		t.Fatalf("entry1 = %+v", resp.Entries[1])
	}
	// Reading the audit log writes no audit row of its own.
	if a, _ := st.RecentAudits(ctx, 0, 10); len(a) != 2 {
		t.Fatalf("audit read recorded an audit row: %+v", a)
	}
	// An unauthed read is 401.
	if rec := do(h, httptest.NewRequest("GET", contract.PathAdminAudit, nil)); rec.Code != http.StatusUnauthorized {
		t.Fatalf("audit no auth: %d, want 401", rec.Code)
	}
}

// GET /admin/audit paginates with ?limit + ?before (a row-id cursor), newest-first
// (doc 20 A4): a first page of N, then an older page after the last id, no overlap.
func TestAdminAuditPagination(t *testing.T) {
	h, st := newTestAdminServer(t, testAdminToken)
	ctx := context.Background()
	for i := 1; i <= 3; i++ {
		if err := st.AppendAudit(ctx, "ping", "", int64(i*100)); err != nil {
			t.Fatal(err)
		}
	}

	page := func(query string) []contract.AdminAuditEntry {
		req := httptest.NewRequest("GET", contract.PathAdminAudit+query, nil)
		req.Header.Set("Authorization", "Bearer "+testAdminToken)
		rec := do(h, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("audit %q: %d", query, rec.Code)
		}
		var resp contract.AdminAuditResponse
		if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
			t.Fatal(err)
		}
		return resp.Entries
	}

	// First page: the two newest (ids 3, 2), newest first, each carrying its id.
	first := page("?limit=2")
	if len(first) != 2 || first[0].ID != 3 || first[1].ID != 2 {
		t.Fatalf("first page = %+v", first)
	}
	// Older page after the last id: just the remaining oldest (id 1), no overlap.
	older := page("?limit=2&before=2")
	if len(older) != 1 || older[0].ID != 1 {
		t.Fatalf("older page = %+v", older)
	}
}

// The metrics endpoint (doc 20 A5): an authed read returns identifier-free totals
// that reflect the seeded rows; an unauthed read is the uniform 401; and the read
// is never audited (it is telemetry, not an action).
func TestAdminMetrics(t *testing.T) {
	h, st := newTestAdminServer(t, testAdminToken)
	ctx := context.Background()
	authed := func() *httptest.ResponseRecorder {
		req := httptest.NewRequest("GET", contract.PathAdminMetrics, nil)
		req.Header.Set("Authorization", "Bearer "+testAdminToken)
		return do(h, req)
	}

	// An unauthed read is rejected like every admin endpoint, never reaching the data.
	if rec := do(h, httptest.NewRequest("GET", contract.PathAdminMetrics, nil)); rec.Code != http.StatusUnauthorized {
		t.Fatalf("metrics no auth: %d, want 401", rec.Code)
	}

	// A fresh store reports zeros (and the body decodes to the response shape).
	var fresh contract.AdminMetricsResponse
	rec := authed()
	if rec.Code != http.StatusOK {
		t.Fatalf("metrics: %d", rec.Code)
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &fresh); err != nil {
		t.Fatal(err)
	}
	if fresh.Aliases != 0 || fresh.PendingReports != 0 {
		t.Fatalf("fresh metrics = %+v, want zeros", fresh)
	}

	// Seed two alias rows and a reported name; the totals reflect them.
	for _, id := range []string{strings.Repeat("a", 43), strings.Repeat("b", 43)} {
		if ok, err := st.WriteAlias(ctx, id, []byte("cipher"), "tok", 100, sql.NullInt64{}, false); err != nil || !ok {
			t.Fatalf("seed alias %s: ok=%v err=%v", id, ok, err)
		}
	}
	if _, err := st.ClaimVanityName(ctx, "robin", strings.Repeat("a", 43), 1); err != nil {
		t.Fatal(err)
	}
	if err := st.AddVanityReport(ctx, "robin", contract.ReportAbuse, 100); err != nil {
		t.Fatal(err)
	}

	var seeded contract.AdminMetricsResponse
	if err := json.Unmarshal(authed().Body.Bytes(), &seeded); err != nil {
		t.Fatal(err)
	}
	if seeded.Aliases != 2 {
		t.Fatalf("aliases = %d, want 2", seeded.Aliases)
	}
	if seeded.PendingReports != 1 {
		t.Fatalf("pendingReports = %d, want 1", seeded.PendingReports)
	}

	// The read is telemetry, not an action: it writes no audit row.
	if entries, err := st.RecentAudits(ctx, 0, 10); err != nil || len(entries) != 0 {
		t.Fatalf("metrics read should not audit: entries=%d err=%v", len(entries), err)
	}
}

// The Findable review flow over the admin endpoints: the queue lists reported
// names (authed), takedown revokes the name + clears its reports + writes an audit
// row, and dismiss clears reports without revoking. Reads stay unauthed-rejected.
func TestAdminFindableReview(t *testing.T) {
	h, st := newTestAdminServer(t, testAdminToken)
	ctx := context.Background()
	bearer := "Bearer " + testAdminToken
	authed := func(method, path string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, path, nil)
		req.Header.Set("Authorization", bearer)
		return do(h, req)
	}

	// Seed a registered name with two reports (store-level; intake has its own test).
	if _, err := st.ClaimVanityName(ctx, "robin", strings.Repeat("A", 43), 1); err != nil {
		t.Fatal(err)
	}
	if err := st.AddVanityReport(ctx, "robin", contract.ReportImpersonation, 100); err != nil {
		t.Fatal(err)
	}
	if err := st.AddVanityReport(ctx, "robin", contract.ReportAbuse, 200); err != nil {
		t.Fatal(err)
	}

	// The queue lists robin with its count; an unauthed read is 401.
	rec := authed("GET", contract.PathAdminReports)
	if rec.Code != http.StatusOK {
		t.Fatalf("reports: %d", rec.Code)
	}
	var resp contract.AdminReportsResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if len(resp.Reports) != 1 || resp.Reports[0].Name != "robin" || resp.Reports[0].Count != 2 {
		t.Fatalf("queue = %+v", resp.Reports)
	}
	if rec := do(h, httptest.NewRequest("GET", contract.PathAdminReports, nil)); rec.Code != http.StatusUnauthorized {
		t.Fatalf("reports no auth: %d, want 401", rec.Code)
	}

	// Takedown: the name stops resolving, its reports clear, and it is audited.
	if rec := authed("POST", "/admin/vanity/robin/takedown"); rec.Code != http.StatusNoContent {
		t.Fatalf("takedown: %d", rec.Code)
	}
	if _, found, _ := st.ResolveVanityName(ctx, "robin"); found {
		t.Fatal("after takedown: robin should not resolve")
	}
	if got, _ := st.PendingVanityReports(ctx, 10); len(got) != 0 {
		t.Fatalf("takedown left reports: %+v", got)
	}
	if a, _ := st.RecentAudits(ctx, 0, 10); len(a) == 0 || a[0].Action != "vanity.takedown" || a[0].Target != "robin" {
		t.Fatalf("takedown not audited: %+v", a)
	}

	// Dismiss: clears a name's reports without revoking, and is audited. The name is
	// registered so the read-side queue surfaces it (only live names are actionable).
	if _, err := st.ClaimVanityName(ctx, "alice", strings.Repeat("B", 43), 250); err != nil {
		t.Fatal(err)
	}
	if err := st.AddVanityReport(ctx, "alice", contract.ReportSpam, 300); err != nil {
		t.Fatal(err)
	}
	if rec := authed("POST", "/admin/vanity/alice/dismiss"); rec.Code != http.StatusNoContent {
		t.Fatalf("dismiss: %d", rec.Code)
	}
	if got, _ := st.PendingVanityReports(ctx, 10); len(got) != 0 {
		t.Fatalf("dismiss left reports: %+v", got)
	}
	if a, _ := st.RecentAudits(ctx, 0, 10); a[0].Action != "vanity.dismiss" || a[0].Target != "alice" {
		t.Fatalf("dismiss not audited: %+v", a)
	}
}

// failingAuditor is an audit appender that always errors, so a test can drive the
// audit-before-mutate failure path without corrupting the real store.
type failingAuditor struct{}

func (failingAuditor) AppendAudit(context.Context, string, string, int64) error {
	return errors.New("audit unavailable")
}

// Audit-before-mutate (doc 20): if the audit append fails, the mutation must not
// run. With a failing auditor a takedown is a 500 and leaves the name still
// resolving, its reports intact, and nothing in the real audit log. The ordering
// in auditOrFail is the only thing guaranteeing this, so it gets a test rather than
// a comment: reorder it and this fails.
func TestAdminAuditFailureBlocksMutation(t *testing.T) {
	srv, st := newTestAdminSrv(t, testAdminToken)
	srv.auditor = failingAuditor{}
	h := srv.Handler()
	ctx := context.Background()

	if _, err := st.ClaimVanityName(ctx, "robin", strings.Repeat("A", 43), 1); err != nil {
		t.Fatal(err)
	}
	if err := st.AddVanityReport(ctx, "robin", contract.ReportAbuse, 100); err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest("POST", "/admin/vanity/robin/takedown", nil)
	req.Header.Set("Authorization", "Bearer "+testAdminToken)
	if rec := do(h, req); rec.Code != http.StatusInternalServerError {
		t.Fatalf("takedown with failing audit: %d, want 500", rec.Code)
	}

	if _, found, _ := st.ResolveVanityName(ctx, "robin"); !found {
		t.Fatal("mutation ran despite audit failure: robin no longer resolves")
	}
	if got, _ := st.PendingVanityReports(ctx, 10); len(got) != 1 {
		t.Fatalf("mutation ran despite audit failure: reports = %+v", got)
	}
	// The failing auditor wrote nothing, so the real log stays empty.
	if a, _ := st.RecentAudits(ctx, 0, 10); len(a) != 0 {
		t.Fatalf("audit log not empty after a failed append: %+v", a)
	}
}

// The "Something wrong?" review flow over the admin endpoints (doc 35): the queue
// lists reports with the note the person typed (authed), resolve deletes one and
// writes an audit row keyed by the opaque id (never the note), and reads stay
// unauthed-rejected.
func TestAdminFeedbackReview(t *testing.T) {
	h, st := newTestAdminServer(t, testAdminToken)
	ctx := context.Background()
	bearer := "Bearer " + testAdminToken
	authed := func(method, path string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, path, nil)
		req.Header.Set("Authorization", bearer)
		return do(h, req)
	}

	if err := st.AddFeedback(ctx, contract.FeedbackBroken, "the share button does nothing", 100); err != nil {
		t.Fatal(err)
	}

	// The queue lists the report with its note; an unauthed read is 401.
	rec := authed("GET", contract.PathAdminFeedback)
	if rec.Code != http.StatusOK {
		t.Fatalf("feedback queue: %d", rec.Code)
	}
	var resp contract.AdminFeedbackResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if len(resp.Feedback) != 1 || resp.Feedback[0].Reason != contract.FeedbackBroken ||
		resp.Feedback[0].Body != "the share button does nothing" {
		t.Fatalf("queue = %+v", resp.Feedback)
	}
	if rec := do(h, httptest.NewRequest("GET", contract.PathAdminFeedback, nil)); rec.Code != http.StatusUnauthorized {
		t.Fatalf("feedback no auth: %d, want 401", rec.Code)
	}

	// Resolve: the report leaves the queue and the action is audited by opaque id.
	idStr := strconv.FormatInt(resp.Feedback[0].ID, 10)
	if rec := authed("POST", "/admin/feedback/"+idStr+"/resolve"); rec.Code != http.StatusNoContent {
		t.Fatalf("resolve: %d", rec.Code)
	}
	if n, _ := st.OpenFeedbackCount(ctx); n != 0 {
		t.Fatalf("resolve left the report, count = %d", n)
	}
	if a, _ := st.RecentAudits(ctx, 0, 10); len(a) == 0 || a[0].Action != "feedback.resolve" || a[0].Target != idStr {
		t.Fatalf("resolve not audited: %+v", a)
	}
	// A non-numeric id is a 400.
	if rec := authed("POST", "/admin/feedback/abc/resolve"); rec.Code != http.StatusBadRequest {
		t.Fatalf("bad id: %d, want 400", rec.Code)
	}
}

// The review endpoints are admin-gated: disabled admin = bare 404.
func TestAdminFindableReviewGatedOffWithAdmin(t *testing.T) {
	h := newTestServer(t) // admin disabled
	if rec := do(h, httptest.NewRequest("GET", contract.PathAdminReports, nil)); rec.Code != http.StatusNotFound {
		t.Fatalf("reports while admin off: %d, want 404", rec.Code)
	}
	if rec := do(h, httptest.NewRequest("GET", contract.PathAdminFeedback, nil)); rec.Code != http.StatusNotFound {
		t.Fatalf("feedback while admin off: %d, want 404", rec.Code)
	}
}

// Admin A3: account-disable deletes the account blob, alias-revoke removes the
// alias (it reads back as a decoy) and frees its vanity name, and lookup returns
// opaque metadata. All admin-gated and (mutations) audited.
func TestAdminAccountAliasManagement(t *testing.T) {
	h, st := newTestAdminServer(t, testAdminToken)
	ctx := context.Background()
	bearer := "Bearer " + testAdminToken
	authed := func(method, path string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, path, nil)
		req.Header.Set("Authorization", bearer)
		return do(h, req)
	}

	// Disable an account blob.
	acct := randID(t)
	if _, _, _, err := st.PutAccount(ctx, acct, []byte("blob"), "wt", 0, 1); err != nil {
		t.Fatal(err)
	}
	if rec := authed("POST", "/admin/account/"+acct+"/disable"); rec.Code != http.StatusNoContent {
		t.Fatalf("disable: %d", rec.Code)
	}
	if _, _, found, _ := st.GetAccount(ctx, acct); found {
		t.Fatal("account blob still present after disable")
	}

	// Revoke an alias that a vanity name points at: the alias is gone and the name
	// stops resolving.
	alias := publishAlias(t, h, "owner-wt")
	if _, err := st.ClaimVanityName(ctx, "robin", alias, 1); err != nil {
		t.Fatal(err)
	}
	if rec := authed("POST", "/admin/alias/"+alias+"/revoke"); rec.Code != http.StatusNoContent {
		t.Fatalf("revoke: %d", rec.Code)
	}
	if _, _, found, _ := st.GetAlias(ctx, alias); found {
		t.Fatal("alias still present after revoke")
	}
	if _, found, _ := st.ResolveVanityName(ctx, "robin"); found {
		t.Fatal("vanity name still resolves after its alias was revoked")
	}

	// Both mutations are audited.
	a, _ := st.RecentAudits(ctx, 0, 10)
	verbs := map[string]bool{}
	for _, e := range a {
		verbs[e.Action] = true
	}
	if !verbs["account.disable"] || !verbs["alias.revoke"] {
		t.Fatalf("missing audit verbs: %+v", a)
	}

	// Lookup returns opaque metadata for an existing record.
	acct2 := randID(t)
	if _, _, _, err := st.PutAccount(ctx, acct2, []byte("blob-data"), "wt", 0, 5); err != nil {
		t.Fatal(err)
	}
	rec := authed("GET", "/admin/lookup/"+acct2)
	if rec.Code != http.StatusOK {
		t.Fatalf("lookup: %d", rec.Code)
	}
	var resp contract.AdminLookupResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if !resp.Account.Exists || resp.Account.SizeBytes != int64(len("blob-data")) || resp.Alias.Exists {
		t.Fatalf("lookup body = %+v", resp)
	}

	// Gating: unauthed is 401, malformed id is 400.
	if rec := do(h, httptest.NewRequest("POST", "/admin/alias/"+alias+"/revoke", nil)); rec.Code != http.StatusUnauthorized {
		t.Fatalf("revoke no auth: %d, want 401", rec.Code)
	}
	if rec := authed("GET", "/admin/lookup/not-a-valid-id"); rec.Code != http.StatusBadRequest {
		t.Fatalf("lookup malformed id: %d, want 400", rec.Code)
	}
}

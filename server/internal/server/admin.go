package server

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"net/http"
	"strconv"
	"strings"

	"sti.care/api/internal/contract"
	"sti.care/api/internal/metrics"
	"sti.care/api/internal/store"
	"sti.care/api/internal/vanityname"
)

// The operator surface (doc 20): a minimal, bearer-gated, audited set of admin
// endpoints for the governance actions the blind store leaves to a human. The
// admin secret unlocks NONE of the encrypted content; everything here stays within
// the blind-store boundary (opaque records and metadata only). A1 is the auth +
// flag + audit + page gate (GET /admin/ping); mutations land in later slices.

// Audit action names. Stable, opaque verbs written to the admin_audit log; they
// name an action, never user content.
const (
	auditActionPing           = "ping"
	auditActionTakedown       = "vanity.takedown"
	auditActionTakedownAuto   = "vanity.takedown.auto" // hands-free, from a rule-match report
	auditActionDismiss        = "vanity.dismiss"
	auditActionAccountDisable = "account.disable"
	auditActionAliasRevoke    = "alias.revoke"
)

// adminReportsLimit caps the review queue page. The queue is operator-facing and
// small in practice; a high bound keeps it a single fetch without unbounded reads.
const adminReportsLimit = 200

// adminAuditPage is the default activity page size; adminAuditLimit caps a
// caller-supplied `limit` so a single request can't read the whole log (doc 20 A4).
const (
	adminAuditPage  = 50
	adminAuditLimit = 200
)

// auditQuery parses the GET /admin/audit pagination params: `before` (a row-id
// cursor, default 0 = newest) and `limit` (default adminAuditPage, clamped to
// [1, adminAuditLimit]). Malformed values fall back to the defaults rather than
// erroring, so a bad cursor degrades to the first page instead of a 400.
func auditQuery(r *http.Request) (before int64, limit int) {
	before, _ = strconv.ParseInt(r.URL.Query().Get("before"), 10, 64)
	if before < 0 {
		before = 0
	}
	limit = adminAuditPage
	if n, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && n > 0 {
		limit = n
	}
	if limit > adminAuditLimit {
		limit = adminAuditLimit
	}
	return before, limit
}

// registerAdminRoutes mounts the operator surface, but ONLY when it is enabled.
// When disabled (the default) nothing is registered, so every /admin path is a
// bare 404 from the mux and the surface cannot even be probed for existence.
func (s *Server) registerAdminRoutes() {
	if !s.cfg.AdminEnabled {
		return
	}
	s.mux.HandleFunc("GET "+contract.PathAdminPing, s.requireAdmin(s.handleAdminPing))
	// Findable review (doc 17/20 A2): the report queue and the two one-click
	// reviewer actions. Both mutations are audited; volume never auto-acts.
	s.mux.HandleFunc("GET "+contract.PathAdminReports, s.requireAdmin(s.handleAdminReports))
	// Recent admin activity (doc 20 A4): a read-only tail of the audit log.
	s.mux.HandleFunc("GET "+contract.PathAdminAudit, s.requireAdmin(s.handleAdminAudit))
	// Aggregate service metrics (doc 20 A5): identifier-free totals for the dashboard.
	s.mux.HandleFunc("GET "+contract.PathAdminMetrics, s.requireAdmin(s.handleAdminMetrics))
	s.mux.HandleFunc("POST /admin/vanity/{name}/takedown", s.requireAdmin(s.handleVanityTakedown))
	s.mux.HandleFunc("POST /admin/vanity/{name}/dismiss", s.requireAdmin(s.handleVanityDismiss))
	// Account / alias management (doc 20 A3): all within the blind-store boundary.
	// Delete/revoke opaque records and read opaque metadata, never any content.
	s.mux.HandleFunc("POST /admin/account/{id}/disable", s.requireAdmin(s.handleAccountDisable))
	s.mux.HandleFunc("POST /admin/alias/{id}/revoke", s.requireAdmin(s.handleAliasRevoke))
	s.mux.HandleFunc("GET /admin/lookup/{id}", s.requireAdmin(s.handleAdminLookup))
}

// requireAdmin gates an admin handler: a tight per-IP rate limit first (so an
// unauthenticated flood is shed cheaply and cannot probe at speed), then a
// constant-time bearer check. A wrong or missing token is a uniform 401 with no
// detail; an over-budget caller is a 429. Neither path reaches the wrapped handler,
// so only an authenticated request is ever audited or acted on.
func (s *Server) requireAdmin(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !s.adminLim.allow(clientIP(r), s.now()) {
			s.writeError(w, http.StatusTooManyRequests, contract.ErrRateLimited, "")
			return
		}
		if !s.adminAuthorized(r) {
			s.writeError(w, http.StatusUnauthorized, contract.ErrUnauthorized, "")
			return
		}
		next(w, r)
	}
}

// adminAuthorized reports whether the request carries the correct admin bearer
// token. Both sides are hashed to a fixed 32 bytes before the constant-time
// compare: a bare ConstantTimeCompare returns immediately on a length mismatch,
// which would leak the secret's length through timing; hashing equalizes length
// and keeps the comparison constant-time regardless of the attacker's input. An
// empty configured token never authorizes (defense in depth: boot already refuses
// to enable admin without a non-trivial secret).
func (s *Server) adminAuthorized(r *http.Request) bool {
	if s.cfg.AdminToken == "" {
		return false
	}
	const prefix = "Bearer "
	h := r.Header.Get("Authorization")
	if !strings.HasPrefix(h, prefix) {
		return false
	}
	got := sha256.Sum256([]byte(strings.TrimPrefix(h, prefix)))
	want := sha256.Sum256([]byte(s.cfg.AdminToken))
	return subtle.ConstantTimeCompare(got[:], want[:]) == 1
}

// handleAdminPing validates the token (via requireAdmin) and returns 204. The
// admin page calls it once after the operator enters the secret, to confirm it
// before rendering anything. A successful ping is a real "admin surface accessed"
// event, so it is audited like any other admin action; a failed token never
// reaches here (requireAdmin already returned 401), so failures are NOT audited
// (they are rate-limited and metered), which denies an attacker an audit-flood.
func (s *Server) handleAdminPing(w http.ResponseWriter, r *http.Request) {
	s.audit(r.Context(), auditActionPing, "")
	w.WriteHeader(http.StatusNoContent)
}

// audit appends an admin action to the log. It logs (and meters) a store failure
// rather than failing the request: ping already passed auth and should not 500 on
// an audit hiccup. Mutating endpoints instead use auditOrFail, so no mutation is
// ever performed without a durable record.
func (s *Server) audit(ctx context.Context, action, target string) {
	if err := s.auditor.AppendAudit(ctx, action, target, s.now()); err != nil {
		s.metrics.Error(metrics.ErrStore)
		s.log.Error("admin audit", "action", action, "err", err)
	}
}

// auditOrFail writes the audit row for a MUTATION before the mutation runs, and
// reports whether it succeeded. A caller that gets false has already had a 500
// written and must NOT proceed: this is what guarantees no admin mutation is ever
// performed without a durable audit record (doc 20).
func (s *Server) auditOrFail(ctx context.Context, w http.ResponseWriter, action, target string) bool {
	if err := s.auditor.AppendAudit(ctx, action, target, s.now()); err != nil {
		s.metrics.Error(metrics.ErrStore)
		s.log.Error("admin audit", "action", action, "err", err)
		s.writeError(w, http.StatusInternalServerError, contract.ErrInternal, "")
		return false
	}
	return true
}

// handleAdminReports answers GET /admin/reports: the Findable review queue, one
// row per reported name (name, count, most-recent reason, first-reported time),
// busiest first. A read, so it is not audited (only mutations and the session
// ping are). Opaque only: public names + fixed reason codes, no reporter identity.
func (s *Server) handleAdminReports(w http.ResponseWriter, r *http.Request) {
	reports, err := s.st.PendingVanityReports(r.Context(), adminReportsLimit)
	if err != nil {
		s.writeError(w, http.StatusInternalServerError, contract.ErrInternal, "")
		return
	}
	out := make([]contract.AdminReport, len(reports))
	for i, v := range reports {
		out[i] = contract.AdminReport{Name: v.Name, Reason: v.Reason, Count: v.Count, CreatedAt: v.CreatedAt}
	}
	s.writeJSON(w, http.StatusOK, contract.AdminReportsResponse{Reports: out})
}

// handleAdminAudit answers GET /admin/audit: the most recent admin actions, newest
// first (doc 20 A4). A read, so it is not itself audited (only mutations and the
// session ping are). Opaque only: a fixed action verb plus an id/name target and a
// timestamp, never user content, so it stays within the blind-store boundary.
func (s *Server) handleAdminAudit(w http.ResponseWriter, r *http.Request) {
	before, limit := auditQuery(r)
	entries, err := s.st.RecentAudits(r.Context(), before, limit)
	if err != nil {
		s.writeError(w, http.StatusInternalServerError, contract.ErrInternal, "")
		return
	}
	out := make([]contract.AdminAuditEntry, len(entries))
	for i, e := range entries {
		out[i] = contract.AdminAuditEntry{ID: e.ID, Action: e.Action, Target: e.Target, CreatedAt: e.CreatedAt}
	}
	s.writeJSON(w, http.StatusOK, contract.AdminAuditResponse{Entries: out})
}

// handleAdminMetrics answers GET /admin/metrics: aggregate, identifier-free service
// totals for the operator dashboard (doc 20 A5). A read, so it is not audited. Every
// figure is a count of opaque rows or a system size (the same blind telemetry the
// store already samples for /metrics), never a per-account or per-id value, so it
// stays within the blind-store boundary (doc 12). The pending-review count reuses the
// review-queue read and is capped at adminReportsLimit like that queue.
func (s *Server) handleAdminMetrics(w http.ResponseWriter, r *http.Request) {
	st, err := s.st.Stats(r.Context())
	if err != nil {
		s.writeError(w, http.StatusInternalServerError, contract.ErrInternal, "")
		return
	}
	reports, err := s.st.PendingVanityReports(r.Context(), adminReportsLimit)
	if err != nil {
		s.writeError(w, http.StatusInternalServerError, contract.ErrInternal, "")
		return
	}
	s.writeJSON(w, http.StatusOK, contract.AdminMetricsResponse{
		Accounts:       st.AccountRows,
		Aliases:        st.AliasRows,
		Knocks:         st.KnockRows,
		SendQueueDepth: st.SendQueueDepth,
		DBSizeBytes:    st.DBSizeBytes,
		PendingReports: len(reports),
	})
}

// handleVanityTakedown answers POST /admin/vanity/{name}/takedown: the reviewer
// revokes a reported name into the 24h lock and clears its reports. Same effect
// as an owner release (revoke -> lock), no punitive state. Audited before acting.
func (s *Server) handleVanityTakedown(w http.ResponseWriter, r *http.Request) {
	name := vanityname.Normalize(r.PathValue("name"))
	if !vanityname.ValidFormat(name) {
		s.writeError(w, http.StatusBadRequest, contract.ErrBadRequest, "malformed name")
		return
	}
	if !s.auditOrFail(r.Context(), w, auditActionTakedown, name) {
		return
	}
	if err := s.st.ReleaseVanityName(r.Context(), name, s.now(), s.cfg.VanityLockWindow.Milliseconds()); err != nil {
		s.writeError(w, http.StatusInternalServerError, contract.ErrInternal, "")
		return
	}
	if err := s.st.ClearVanityReports(r.Context(), name); err != nil {
		s.writeError(w, http.StatusInternalServerError, contract.ErrInternal, "")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// handleVanityDismiss answers POST /admin/vanity/{name}/dismiss: the reviewer
// clears a name's reports without acting (the name stays registered). Audited
// before acting, so a dismissed complaint is still reconstructable.
func (s *Server) handleVanityDismiss(w http.ResponseWriter, r *http.Request) {
	name := vanityname.Normalize(r.PathValue("name"))
	if !vanityname.ValidFormat(name) {
		s.writeError(w, http.StatusBadRequest, contract.ErrBadRequest, "malformed name")
		return
	}
	if !s.auditOrFail(r.Context(), w, auditActionDismiss, name) {
		return
	}
	if err := s.st.ClearVanityReports(r.Context(), name); err != nil {
		s.writeError(w, http.StatusInternalServerError, contract.ErrInternal, "")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// handleAccountDisable answers POST /admin/account/{id}/disable: a working-delete
// of the account's sync blob (doc 20 A3). The blind store holds no link from an
// account to its aliases, so this removes the blob only; the owner's aliases are
// revoked separately via the alias endpoint. Idempotent + audited before acting.
func (s *Server) handleAccountDisable(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !contract.ValidID(id) {
		s.writeError(w, http.StatusBadRequest, contract.ErrBadRequest, "malformed id")
		return
	}
	if !s.auditOrFail(r.Context(), w, auditActionAccountDisable, id) {
		return
	}
	if err := s.st.DeleteAccount(r.Context(), id); err != nil {
		s.writeError(w, http.StatusInternalServerError, contract.ErrInternal, "")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// handleAliasRevoke answers POST /admin/alias/{id}/revoke: force-remove an alias
// row (it then reads back as a decoy, like a never-existed id) and free any vanity
// name pointing at it into the 24h lock. Idempotent + audited before acting.
func (s *Server) handleAliasRevoke(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !contract.ValidID(id) {
		s.writeError(w, http.StatusBadRequest, contract.ErrBadRequest, "malformed id")
		return
	}
	if !s.auditOrFail(r.Context(), w, auditActionAliasRevoke, id) {
		return
	}
	if err := s.st.AdminDeleteAlias(r.Context(), id); err != nil {
		s.writeError(w, http.StatusInternalServerError, contract.ErrInternal, "")
		return
	}
	if err := s.st.ReleaseVanityNamesForAlias(r.Context(), id, s.now(), s.cfg.VanityLockWindow.Milliseconds()); err != nil {
		s.writeError(w, http.StatusInternalServerError, contract.ErrInternal, "")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// handleAdminLookup answers GET /admin/lookup/{id}: opaque metadata for a record
// (exists / byte size / last-written) across the alias, account, and inbox
// namespaces. A read, so not audited; returns nothing but sizes and timestamps,
// never content, so it stays within the blind-store boundary.
func (s *Server) handleAdminLookup(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !contract.ValidID(id) {
		s.writeError(w, http.StatusBadRequest, contract.ErrBadRequest, "malformed id")
		return
	}
	m, err := s.st.LookupRecord(r.Context(), id)
	if err != nil {
		s.writeError(w, http.StatusInternalServerError, contract.ErrInternal, "")
		return
	}
	info := func(ri store.RecordInfo) contract.AdminRecordInfo {
		return contract.AdminRecordInfo{Exists: ri.Exists, SizeBytes: ri.SizeBytes, UpdatedAt: ri.UpdatedAt}
	}
	s.writeJSON(w, http.StatusOK, contract.AdminLookupResponse{
		Alias:   info(m.Alias),
		Account: info(m.Account),
		Inbox:   info(m.Inbox),
	})
}

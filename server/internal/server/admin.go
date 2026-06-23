package server

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"net/http"
	"strings"

	"sti.care/api/internal/contract"
	"sti.care/api/internal/metrics"
)

// The operator surface (doc 20): a minimal, bearer-gated, audited set of admin
// endpoints for the governance actions the blind store leaves to a human. The
// admin secret unlocks NONE of the encrypted content; everything here stays within
// the blind-store boundary (opaque records and metadata only). A1 is the auth +
// flag + audit + page gate (GET /admin/ping); mutations land in later slices.

// Audit action names. Stable, opaque verbs written to the admin_audit log; they
// name an action, never user content.
const auditActionPing = "ping"

// registerAdminRoutes mounts the operator surface, but ONLY when it is enabled.
// When disabled (the default) nothing is registered, so every /admin path is a
// bare 404 from the mux and the surface cannot even be probed for existence.
func (s *Server) registerAdminRoutes() {
	if !s.cfg.AdminEnabled {
		return
	}
	s.mux.HandleFunc("GET "+contract.PathAdminPing, s.requireAdmin(s.handleAdminPing))
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
// an audit hiccup. Mutating endpoints (later slices) must instead treat an audit
// failure as fatal, so no mutation is ever performed without a durable record.
func (s *Server) audit(ctx context.Context, action, target string) {
	if err := s.st.AppendAudit(ctx, action, target, s.now()); err != nil {
		s.metrics.Error(metrics.ErrStore)
		s.log.Error("admin audit", "action", action, "err", err)
	}
}

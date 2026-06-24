// Package server is the HTTP layer over the blind store. It enforces the wire
// contract, makes alias resolution and knocks existence-uniform, and sheds load
// without ever leaking existence through a status code.
package server

import (
	_ "embed"

	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"math/rand/v2"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"sti.care/api/internal/contract"
	"sti.care/api/internal/metrics"
	"sti.care/api/internal/store"
	"sti.care/api/internal/vanityname"
)

//go:embed landing.html
var landingHTML []byte

// Config tunes the server. DecoySecret is required (>= 32 bytes); everything else
// has sane defaults.
type Config struct {
	DecoySecret    []byte
	KnockTTL       time.Duration // default 4 days
	SendMaxJitter  time.Duration // default 2 min; spreads wake timing
	CoverWindow    time.Duration // spreads the cover broadcast (doc 13 §2); set from STI_COVER_WINDOW, 0 = no spread
	MaxInflight    int           // global concurrency cap; default 256
	SensitiveWait  time.Duration // max wait for a slot on /a, /knock; default 5s
	IPRatePerSec   float64       // non-sensitive endpoints; default 5
	IPBurst        float64       // default 20
	KnockRatePerID float64       // silent cap on /knock; default 1/sec
	KnockBurst     float64       // default 10
	// AllowedOrigins are the exact browser origins permitted to call the api
	// cross-origin (e.g. https://sti.care). Empty means no CORS, which is correct
	// for same-origin or non-browser callers. No wildcard: each origin is listed.
	AllowedOrigins []string
	// NotifyEnabled gates targeted-wake delivery. Default false: the
	// not-fully-blind targeted wake must not ship until the cover-wake
	// decorrelation fix lands (doc 10 §F). Off => /notify enqueues nothing and the
	// drain delivers nothing, so the feature is inert end to end.
	NotifyEnabled bool
	// Sender delivers contentless Web Push wakes. nil disables delivery (the
	// default); set it only alongside NotifyEnabled.
	Sender Sender
	// VAPIDPublicKey is the Web Push public key served at GET /vapid so a browser
	// can subscribe. Empty (the default) means push is not configured and the
	// client treats it as unavailable. Public, not a secret.
	VAPIDPublicKey string
	// AdminEnabled gates the entire operator surface (doc 20). Off by default, so
	// production ships dark: when false no /admin route is registered at all, so
	// those paths are a bare 404 and the surface is invisible. main.go refuses to
	// boot with this true unless AdminToken is set and non-trivial.
	AdminEnabled bool
	// AdminToken is the shared bearer secret for the admin surface, compared
	// constant-time and never logged. By the time it reaches here main.go has
	// enforced a length floor (when AdminEnabled), so it is trusted non-trivial.
	AdminToken string
	// AdminRatePerSec / AdminBurst bound /admin/* per client IP, tightly: the
	// surface is for one operator, so a low budget slows any brute force without
	// affecting real use. Zero leaves the defaults (1/sec, burst 5).
	AdminRatePerSec float64
	AdminBurst      float64
	// FindableEnabled gates the vanity-name WRITE endpoints (PUT/DELETE /u/{name},
	// doc 17). Off by default: GET /u resolve stays live (and 404s an empty
	// directory), but no name can be registered until Findable's launch gate flips
	// this on, so the directory stays empty in production pre-launch.
	FindableEnabled bool
	// VanityLockWindow is the post-release lock during which a freed name is
	// unclaimable (doc 17). Default 24h; lowered by tests to exercise expiry.
	VanityLockWindow time.Duration
	// VanityResolveGlobalPerSec / VanityResolveGlobalBurst bound GET /u resolve
	// across ALL callers, not per IP (doc 17 wants both): the per-IP limit slows one
	// scraper, this caps a distributed scrape of the namespace. Set generously so
	// real use never trips it. Zero leaves the defaults (50/sec, burst 200).
	VanityResolveGlobalPerSec float64
	VanityResolveGlobalBurst  float64
}

func (c *Config) withDefaults() {
	if c.KnockTTL == 0 {
		c.KnockTTL = 4 * 24 * time.Hour
	}
	if c.SendMaxJitter == 0 {
		c.SendMaxJitter = 2 * time.Minute
	}
	// CoverWindow is deliberately NOT defaulted here: 0 is a valid "fan out with no
	// spread" used by tests for a deterministic single-pass broadcast. Production
	// sets it from STI_COVER_WINDOW (main.go), which falls back to 2 min.
	if c.MaxInflight == 0 {
		c.MaxInflight = 256
	}
	if c.SensitiveWait == 0 {
		c.SensitiveWait = 5 * time.Second
	}
	if c.IPRatePerSec == 0 {
		c.IPRatePerSec = 5
	}
	if c.IPBurst == 0 {
		c.IPBurst = 20
	}
	if c.KnockRatePerID == 0 {
		c.KnockRatePerID = 1
	}
	if c.KnockBurst == 0 {
		c.KnockBurst = 10
	}
	if c.AdminRatePerSec == 0 {
		c.AdminRatePerSec = 1
	}
	if c.AdminBurst == 0 {
		c.AdminBurst = 5
	}
	if c.VanityLockWindow == 0 {
		c.VanityLockWindow = 24 * time.Hour
	}
	if c.VanityResolveGlobalPerSec == 0 {
		c.VanityResolveGlobalPerSec = 50
	}
	if c.VanityResolveGlobalBurst == 0 {
		c.VanityResolveGlobalBurst = 200
	}
}

// Server is the HTTP handler set.
type Server struct {
	st          *store.Store
	cfg         Config
	log         *slog.Logger
	now         func() int64 // unix millis; injectable for tests
	ipLimit     *limiter     // visible 429 on non-sensitive endpoints
	knockLim    *limiter     // silent cap on /knock (never a 429)
	adminLim    *limiter     // tight per-IP cap on /admin/* (visible 429)
	uResolveLim *limiter     // single global bucket capping GET /u resolve (doc 17)
	inflight    chan struct{}
	mux         *http.ServeMux
	metrics     *metrics.Metrics // blind aggregate self-telemetry (loopback only)
	sender      Sender           // contentless Web Push delivery; nil disables it
}

// New builds a Server. now may be nil (defaults to the wall clock).
func New(st *store.Store, cfg Config, log *slog.Logger, now func() int64) *Server {
	cfg.withDefaults()
	if now == nil {
		now = func() int64 { return time.Now().UnixMilli() }
	}
	s := &Server{
		st:          st,
		cfg:         cfg,
		log:         log,
		now:         now,
		ipLimit:     newLimiter(cfg.IPRatePerSec, cfg.IPBurst),
		knockLim:    newLimiter(cfg.KnockRatePerID, cfg.KnockBurst),
		adminLim:    newLimiter(cfg.AdminRatePerSec, cfg.AdminBurst),
		uResolveLim: newLimiter(cfg.VanityResolveGlobalPerSec, cfg.VanityResolveGlobalBurst),
		inflight:    make(chan struct{}, cfg.MaxInflight),
		mux:         http.NewServeMux(),
		metrics:     metrics.New(),
		sender:      cfg.Sender,
	}
	s.metrics.SetInflightMax(cfg.MaxInflight)
	// Blind aggregate gauges: row counts of opaque rows and the db file size,
	// sampled lazily at scrape time. They name no subject (doc 12 §3, §6).
	s.metrics.RegisterStats(func(ctx context.Context) (metrics.StatsGauge, error) {
		st, err := s.st.Stats(ctx)
		var oldestAge int64
		if st.OldestSendCreatedAt > 0 {
			if d := s.now() - st.OldestSendCreatedAt; d > 0 {
				oldestAge = d / 1000
			}
		}
		return metrics.StatsGauge{
			DBSizeBytes:               st.DBSizeBytes,
			AliasRows:                 st.AliasRows,
			AccountRows:               st.AccountRows,
			KnockRows:                 st.KnockRows,
			SendQueueDepth:            st.SendQueueDepth,
			SendQueueOldestAgeSeconds: oldestAge,
		}, err
	})
	s.routes()
	return s
}

// Metrics returns the blind self-telemetry registry. Its Handler must be bound on
// a loopback-only listener, never on the public mux (doc 12 §5).
func (s *Server) Metrics() *metrics.Metrics { return s.metrics }

func (s *Server) routes() {
	s.mux.HandleFunc("GET /a/{id}", s.handleAliasGet)
	s.mux.HandleFunc("PUT /a/{id}", s.handleAliasPut)
	s.mux.HandleFunc("GET /inbox/{id}", s.handleInboxGet)
	s.mux.HandleFunc("PUT /inbox/{id}", s.handleInboxPut)
	s.mux.HandleFunc("GET /u/{name}", s.handleVanityResolve)
	if s.cfg.FindableEnabled {
		// The write half of the directory is gated behind the launch flag (doc 17),
		// so the namespace stays empty in production until Findable ships. Resolve
		// (above) stays live and harmlessly 404s an empty directory.
		s.mux.HandleFunc("PUT /u/{name}", s.handleVanityRegister)
		s.mux.HandleFunc("DELETE /u/{name}", s.handleVanityRelease)
		s.mux.HandleFunc("POST /u/{name}/report", s.handleVanityReport)
	}
	s.mux.HandleFunc("GET /acct/{id}", s.handleAccountGet)
	s.mux.HandleFunc("PUT /acct/{id}", s.handleAccountPut)
	s.mux.HandleFunc("DELETE /acct/{id}", s.handleAccountDelete)
	s.mux.HandleFunc("POST /notify", s.handleNotify)
	s.mux.HandleFunc("POST /push/register", s.handlePushRegister)
	s.mux.HandleFunc("POST /knock/{id}", s.handleKnock)
	s.mux.HandleFunc("GET /knock/{id}", s.handleKnockReview)
	s.mux.HandleFunc("GET /healthz", s.handleHealth)
	s.mux.HandleFunc("GET /vapid", s.handleVapid)
	s.mux.HandleFunc("GET /{$}", s.handleRoot) // exactly "/", a public landing
	s.registerAdminRoutes()                    // no-op unless AdminEnabled (doc 20)
}

// Handler returns the http.Handler with the CORS, metrics, and load-shedding
// middleware applied. CORS is outermost so a preflight is answered without taking
// an inflight slot or being counted; metrics wraps shed so a shed 503 is still
// measured.
func (s *Server) Handler() http.Handler { return s.cors(s.observe(s.shed(s.mux))) }

// observe records one requests_total increment and one latency sample per
// request, labeled by the route TEMPLATE only (never the concrete id). It runs
// inside CORS (preflights are not counted) and outside shed (a shed 503 is
// counted). It reads only the method, the template, and the final status code,
// never the body or any header.
func (s *Server) observe(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := s.now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		seconds := float64(s.now()-start) / 1000.0
		s.metrics.Observe(r.Method, r.URL.Path, rec.status, seconds)
	})
}

// statusRecorder captures the response status for metrics without buffering the
// body. It records only the integer status, nothing about the payload.
type statusRecorder struct {
	http.ResponseWriter
	status  int
	written bool
}

func (r *statusRecorder) WriteHeader(code int) {
	if !r.written {
		r.status = code
		r.written = true
	}
	r.ResponseWriter.WriteHeader(code)
}

func (r *statusRecorder) Write(b []byte) (int, error) {
	r.written = true // an implicit 200 if WriteHeader was never called
	return r.ResponseWriter.Write(b)
}

// sensitivePath reports whether a request must stay existence-uniform: it never
// receives a visible 429/503. Only the existence-revealing READS qualify: GET /a,
// GET /inbox, and POST /knock. The PUTs are writes (visible 403/204, rate-limited)
// and are sheddable, so a write flood cannot ride the never-shed path.
func sensitivePath(method, p string) bool {
	return (method == http.MethodGet && strings.HasPrefix(p, contract.PathAliasPrefix)) ||
		(method == http.MethodGet && strings.HasPrefix(p, contract.PathInboxPrefix)) ||
		(method == http.MethodPost && strings.HasPrefix(p, contract.PathKnockPrefix))
}

// shed caps global concurrency. Non-sensitive endpoints get a 503 when the cap is
// full. Sensitive reads are never shed with a visible status: they wait up to
// SensitiveWait for a slot, and if none frees they get the uniform existence-blind
// fallback (a decoy / the fixed knock reply). That bounds both concurrency AND
// queue time without ever leaking existence, even under sustained overload.
func (s *Server) shed(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if sensitivePath(r.Method, r.URL.Path) {
			t := time.NewTimer(s.cfg.SensitiveWait)
			select {
			case s.inflight <- struct{}{}:
				t.Stop()
				s.metrics.IncInflight()
				defer func() { <-s.inflight; s.metrics.DecInflight() }()
				next.ServeHTTP(w, r)
			case <-t.C:
				s.metrics.SensitiveOverload(r.URL.Path)
				s.uniformOverload(w, r)
			}
			return
		}
		select {
		case s.inflight <- struct{}{}:
			s.metrics.IncInflight()
			defer func() { <-s.inflight; s.metrics.DecInflight() }()
			next.ServeHTTP(w, r)
		default:
			s.writeError(w, http.StatusServiceUnavailable, contract.ErrInternal, "overloaded")
		}
	})
}

// uniformOverload is the catastrophic-overload fallback for a sensitive read: the
// same response a normal miss produces, so saturation is indistinguishable from a
// nonexistent id. A real alias served this way decodes to gray client-side, which
// is the accepted degradation (unreachable, then gray).
func (s *Server) uniformOverload(w http.ResponseWriter, r *http.Request) {
	if strings.HasPrefix(r.URL.Path, contract.PathKnockPrefix) {
		s.writeJSON(w, http.StatusOK, contract.KnockResponse{Status: contract.KnockStatus})
		return
	}
	// GET /a or GET /inbox: emit the EXACT decoy a normal miss would, so saturation
	// is indistinguishable from a nonexistent id. The normal miss keys the decoy by
	// the bare id, so this must too (keying by the full path would diverge).
	id := strings.TrimPrefix(r.URL.Path, contract.PathInboxPrefix)
	id = strings.TrimPrefix(id, contract.PathAliasPrefix)
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Cache-Control", "no-store")
	_, _ = w.Write(decoyBytes(s.cfg.DecoySecret, id, contract.AliasPayloadSize))
}

// --- Alias + notify inbox (the fixed-size, existence-uniform reads) ----------
//
// A storeReadFn / storeWriteFn lets the alias and notify-inbox endpoints (which
// are byte-for-byte the same blind, write-token-gated, fixed-size protocol) share
// one GET and one PUT implementation.
type storeReadFn func(ctx context.Context, id string) ([]byte, bool, error)
type storeWriteFn func(ctx context.Context, id string, ct []byte, authHash string, now int64) (bool, error)

func (s *Server) handleAliasGet(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Cache-Control", "no-store")
	_, _ = w.Write(s.aliasPayload(r, r.PathValue("id")))
}

// aliasPayload mirrors fixedPayload but enforces the link's expiry (doc 16): an
// expired alias falls through to the decoy, the SAME response a missing id gets,
// so an expired link stops resolving on time without leaking that it ever existed.
func (s *Server) aliasPayload(r *http.Request, id string) []byte {
	if contract.ValidID(id) {
		ct, expiresAt, found, err := s.st.GetAlias(r.Context(), id)
		if err != nil {
			s.metrics.Error(metrics.ErrStore)
			s.log.Error("alias get", "err", err)
		} else if found && !(expiresAt.Valid && s.now() >= expiresAt.Int64) {
			return ct
		}
	}
	return decoyBytes(s.cfg.DecoySecret, id, contract.AliasPayloadSize)
}

func (s *Server) handleInboxGet(w http.ResponseWriter, r *http.Request) {
	s.handleFixedGet(w, r, s.st.GetInbox, "inbox get")
}

func (s *Server) handleFixedGet(w http.ResponseWriter, r *http.Request, get storeReadFn, label string) {
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Cache-Control", "no-store")
	_, _ = w.Write(s.fixedPayload(r, r.PathValue("id"), get, label))
}

// fixedPayload always returns exactly AliasPayloadSize bytes: the stored
// ciphertext if it exists, otherwise a deterministic decoy. Invalid ids and even
// internal errors fall through to a decoy, so nothing about existence leaks.
func (s *Server) fixedPayload(r *http.Request, id string, get storeReadFn, label string) []byte {
	if contract.ValidID(id) {
		if ct, found, err := get(r.Context(), id); err != nil {
			s.metrics.Error(metrics.ErrStore)
			s.log.Error(label, "err", err)
		} else if found {
			return ct
		}
	}
	return decoyBytes(s.cfg.DecoySecret, id, contract.AliasPayloadSize)
}

// handleVanityResolve answers GET /u/{name} (doc 17, Findable): the name -> alias
// id lookup, and nothing more. The viewer then runs the normal knock/grant flow
// against the returned id. A registered name returns its opaque alias id; an
// unregistered, released, or locked name (or any lookup error, masked) is a bare
// 404 with no body. The directory holds no status/key/identity, so a hit reveals
// only that the name is registered, which is the point of opting in (existence is
// intentionally NOT uniform here, unlike GET /a). The name is normalized before
// lookup, matching the form it is stored in.
func (s *Server) handleVanityResolve(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	// Two caps slow bulk enumeration of the namespace (doc 17): a per-IP bucket
	// slows one scraper, and a single GLOBAL bucket caps a distributed scrape across
	// many IPs. The 429 is independent of whether the name exists, so it adds no
	// existence signal. The global bucket is keyed by a constant so all callers
	// share it.
	if !s.ipLimit.allow(clientIP(r), s.now()) ||
		!s.uResolveLim.allow("u", s.now()) {
		s.writeError(w, http.StatusTooManyRequests, contract.ErrRateLimited, "")
		return
	}
	name := vanityname.Normalize(r.PathValue("name"))
	aliasID, found, err := s.st.ResolveVanityName(r.Context(), name)
	if err != nil {
		s.metrics.Error(metrics.ErrStore)
		s.log.Error("vanity resolve", "err", err)
	}
	if err != nil || !found {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	s.writeJSON(w, http.StatusOK, contract.VanityResolveResponse{AliasID: aliasID})
}

// handleVanityRegister answers PUT /u/{name} (doc 17, Findable; gated): claim a
// vanity name for an alias the caller owns. It enforces the name rules (charset /
// reserved / blocklist), proves the caller owns the target alias via its write
// token, then claims first-come. The name is public, so the unavailable reasons
// (reserved/blocked/taken/locked) are not hidden; only ownership is gated.
func (s *Server) handleVanityRegister(w http.ResponseWriter, r *http.Request) {
	name, err := vanityname.Check(r.PathValue("name"))
	if err != nil {
		if errors.Is(err, vanityname.ErrFormat) {
			s.writeError(w, http.StatusBadRequest, contract.ErrBadRequest, "name must be lowercase a-z, 0-9 or _ and 3-30 characters")
			return
		}
		// Reserved or blocked: the name can never be claimed.
		s.writeError(w, http.StatusConflict, contract.ErrVanityTaken, "name is not available")
		return
	}
	if !s.ipLimit.allow(clientIP(r), s.now()) {
		s.writeError(w, http.StatusTooManyRequests, contract.ErrRateLimited, "")
		return
	}
	var req contract.VanityRegisterRequest
	if err := decodeJSON(r, &req); err != nil || !contract.ValidID(req.AliasID) {
		s.writeError(w, http.StatusBadRequest, contract.ErrBadRequest, "missing or malformed aliasId")
		return
	}
	token := r.Header.Get(contract.HeaderWriteToken)
	if token == "" {
		s.writeError(w, http.StatusBadRequest, contract.ErrBadRequest, "missing write token")
		return
	}
	// Ownership: the caller must hold the write token of the alias the name points
	// at, so a name can never be aimed at someone else's alias.
	owns, err := s.st.VerifyAliasWrite(r.Context(), req.AliasID, hashToken(token))
	if err != nil {
		s.writeError(w, http.StatusInternalServerError, contract.ErrInternal, "")
		return
	}
	if !owns {
		s.writeError(w, http.StatusForbidden, contract.ErrBadRequest, "write token does not own that alias")
		return
	}
	status, err := s.st.ClaimVanityName(r.Context(), name, req.AliasID, s.now())
	if err != nil {
		s.writeError(w, http.StatusInternalServerError, contract.ErrInternal, "")
		return
	}
	switch status {
	case store.VanityClaimed:
		w.WriteHeader(http.StatusNoContent)
	case store.VanityTaken:
		s.writeError(w, http.StatusConflict, contract.ErrVanityTaken, "name is already taken")
	case store.VanityLocked:
		s.writeError(w, http.StatusConflict, contract.ErrVanityTaken, "name is temporarily locked")
	}
}

// handleVanityRelease answers DELETE /u/{name} (doc 17, Findable; gated): the
// owner frees their name into the 24h lock. Authorized by the write token of the
// alias the name currently points at, so only the holder can release it. A name
// that is not actively registered is a 404 (nothing to release).
func (s *Server) handleVanityRelease(w http.ResponseWriter, r *http.Request) {
	name := vanityname.Normalize(r.PathValue("name"))
	if !vanityname.ValidFormat(name) {
		s.writeError(w, http.StatusBadRequest, contract.ErrBadRequest, "malformed name")
		return
	}
	if !s.ipLimit.allow(clientIP(r), s.now()) {
		s.writeError(w, http.StatusTooManyRequests, contract.ErrRateLimited, "")
		return
	}
	token := r.Header.Get(contract.HeaderWriteToken)
	if token == "" {
		s.writeError(w, http.StatusBadRequest, contract.ErrBadRequest, "missing write token")
		return
	}
	aliasID, found, err := s.st.ResolveVanityName(r.Context(), name)
	if err != nil {
		s.writeError(w, http.StatusInternalServerError, contract.ErrInternal, "")
		return
	}
	if !found {
		s.writeError(w, http.StatusNotFound, contract.ErrNotFound, "")
		return
	}
	owns, err := s.st.VerifyAliasWrite(r.Context(), aliasID, hashToken(token))
	if err != nil {
		s.writeError(w, http.StatusInternalServerError, contract.ErrInternal, "")
		return
	}
	if !owns {
		s.writeError(w, http.StatusForbidden, contract.ErrBadRequest, "write token does not own that name")
		return
	}
	if err := s.st.ReleaseVanityName(r.Context(), name, s.now(), s.cfg.VanityLockWindow.Milliseconds()); err != nil {
		s.writeError(w, http.StatusInternalServerError, contract.ErrInternal, "")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// handleVanityReport answers POST /u/{name}/report (doc 17 report-and-takedown;
// gated): public, unauthenticated intake of a report against a vanity name. It
// records the report (a fixed reason code, no reporter identity), then auto-acts
// ONLY on an objective rule match: a reported name that is now reserved or
// blocklisted is taken down hands-free into the lock (covers a name registered
// before a list grew). Volume never auto-acts (that would weaponize false
// reports); a subjective name waits for the one-click admin reviewer. The 202 is
// uniform whether or not the report auto-actioned, so intake leaks nothing.
func (s *Server) handleVanityReport(w http.ResponseWriter, r *http.Request) {
	name := vanityname.Normalize(r.PathValue("name"))
	if !vanityname.ValidFormat(name) {
		s.writeError(w, http.StatusBadRequest, contract.ErrBadRequest, "malformed name")
		return
	}
	if !s.ipLimit.allow(clientIP(r), s.now()) {
		s.writeError(w, http.StatusTooManyRequests, contract.ErrRateLimited, "")
		return
	}
	var req contract.VanityReportRequest
	if err := decodeJSON(r, &req); err != nil || !contract.ValidReportReason(req.Reason) {
		s.writeError(w, http.StatusBadRequest, contract.ErrBadRequest, "missing or invalid reason")
		return
	}
	if err := s.st.AddVanityReport(r.Context(), name, req.Reason, s.now()); err != nil {
		s.writeError(w, http.StatusInternalServerError, contract.ErrInternal, "")
		return
	}
	// Hands-free auto-action on an objective rule match only (reserved/blocked).
	// Recorded in the audit log too (best-effort), so every takedown — admin or
	// automated — is reconstructable; the public request never fails on a log hiccup.
	if vanityname.Reserved(name) || vanityname.Blocked(name) {
		if err := s.st.ReleaseVanityName(r.Context(), name, s.now(), s.cfg.VanityLockWindow.Milliseconds()); err != nil {
			s.metrics.Error(metrics.ErrStore)
			s.log.Error("vanity auto-takedown", "err", err)
		} else {
			s.audit(r.Context(), auditActionTakedownAuto, name)
			if err := s.st.ClearVanityReports(r.Context(), name); err != nil {
				s.metrics.Error(metrics.ErrStore)
				s.log.Error("vanity auto-takedown clear", "err", err)
			}
		}
	}
	w.WriteHeader(http.StatusAccepted)
}

func (s *Server) handleAliasPut(w http.ResponseWriter, r *http.Request) {
	expiresAt, setExpiry, ok := parseExpiresAt(r.Header.Get(contract.HeaderExpiresAt))
	if !ok {
		s.writeError(w, http.StatusBadRequest, contract.ErrBadRequest, "malformed expiry")
		return
	}
	s.handleFixedPut(w, r, func(ctx context.Context, id string, ct []byte, authHash string, now int64) (bool, error) {
		return s.st.WriteAlias(ctx, id, ct, authHash, now, expiresAt, setExpiry)
	})
}

// parseExpiresAt reads the X-Expires-At header (doc 16): absent leaves the stored
// expiry untouched (setExpiry=false); "none" clears it; a non-negative integer is
// an epoch-ms instant. Anything else is rejected (ok=false).
func parseExpiresAt(v string) (expiresAt sql.NullInt64, setExpiry bool, ok bool) {
	switch {
	case v == "":
		return sql.NullInt64{}, false, true
	case v == contract.ExpiresAtNone:
		return sql.NullInt64{}, true, true
	default:
		ms, err := strconv.ParseInt(v, 10, 64)
		if err != nil || ms < 0 {
			return sql.NullInt64{}, false, false
		}
		return sql.NullInt64{Int64: ms, Valid: true}, true, true
	}
}

func (s *Server) handleInboxPut(w http.ResponseWriter, r *http.Request) {
	s.handleFixedPut(w, r, s.st.WriteInbox)
}

func (s *Server) handleFixedPut(w http.ResponseWriter, r *http.Request, write storeWriteFn) {
	id := r.PathValue("id")
	if !contract.ValidID(id) {
		s.writeError(w, http.StatusBadRequest, contract.ErrBadRequest, "malformed id")
		return
	}
	if !s.ipLimit.allow(clientIP(r), s.now()) {
		s.writeError(w, http.StatusTooManyRequests, contract.ErrRateLimited, "")
		return
	}
	token := r.Header.Get(contract.HeaderWriteToken)
	if token == "" {
		s.writeError(w, http.StatusBadRequest, contract.ErrBadRequest, "missing write token")
		return
	}
	body, err := io.ReadAll(io.LimitReader(r.Body, contract.AliasPayloadSize+1))
	if err != nil {
		s.writeError(w, http.StatusBadRequest, contract.ErrBadRequest, "read body")
		return
	}
	if len(body) != contract.AliasPayloadSize {
		// The client pre-pads payloads to exactly the fixed size.
		s.writeError(w, http.StatusBadRequest, contract.ErrBadRequest, "payload must be exactly the fixed size")
		return
	}
	ok, err := write(r.Context(), id, body, hashToken(token), s.now())
	if err != nil {
		s.writeError(w, http.StatusInternalServerError, contract.ErrInternal, "")
		return
	}
	if !ok {
		// PUT is deliberately NOT existence-uniform (unlike the GET reads): 403 here
		// distinguishes "exists, wrong token" from a 204 create. Acceptable: holding
		// the id already implies you may learn it exists, and 256-bit ids are
		// unguessable, so this leaks nothing a write-token holder didn't already know.
		s.writeError(w, http.StatusForbidden, contract.ErrBadRequest, "write token does not match")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// --- Account sync -----------------------------------------------------------

func (s *Server) handleAccountGet(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !contract.ValidID(id) {
		s.writeError(w, http.StatusBadRequest, contract.ErrBadRequest, "malformed id")
		return
	}
	if !s.ipLimit.allow(clientIP(r), s.now()) {
		s.writeError(w, http.StatusTooManyRequests, contract.ErrRateLimited, "")
		return
	}
	ct, version, found, err := s.st.GetAccount(r.Context(), id)
	if err != nil {
		s.writeError(w, http.StatusInternalServerError, contract.ErrInternal, "")
		return
	}
	if !found {
		// 404-on-miss is a deliberate, accepted carve-out (unlike GET /a, which is
		// existence-uniform). Account ids are 256-bit owner-key-derived and never
		// shared, so a 404 only tells a caller who already holds the id that no
		// blob exists there yet, which the owner needs to know to start syncing.
		s.writeError(w, http.StatusNotFound, contract.ErrNotFound, "")
		return
	}
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set(contract.HeaderVersion, strconv.FormatInt(version, 10))
	w.Header().Set("Cache-Control", "no-store")
	_, _ = w.Write(ct)
}

func (s *Server) handleAccountPut(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !contract.ValidID(id) {
		s.writeError(w, http.StatusBadRequest, contract.ErrBadRequest, "malformed id")
		return
	}
	if !s.ipLimit.allow(clientIP(r), s.now()) {
		s.writeError(w, http.StatusTooManyRequests, contract.ErrRateLimited, "")
		return
	}
	body, err := io.ReadAll(io.LimitReader(r.Body, contract.AccountBlobMaxSize+1))
	if err != nil {
		s.writeError(w, http.StatusBadRequest, contract.ErrBadRequest, "read body")
		return
	}
	if len(body) > contract.AccountBlobMaxSize {
		s.writeError(w, http.StatusRequestEntityTooLarge, contract.ErrTooLarge, "")
		return
	}
	version, err := s.st.PutAccount(r.Context(), id, body, s.now())
	if err != nil {
		s.writeError(w, http.StatusInternalServerError, contract.ErrInternal, "")
		return
	}
	w.Header().Set(contract.HeaderVersion, strconv.FormatInt(version, 10))
	w.WriteHeader(http.StatusNoContent)
}

// handleAccountDelete removes the account blob. Like PUT, it is authorized by
// holding the key-derived id (unguessable; only the master derives it), and it
// is idempotent: a missing id still returns 204, revealing nothing. The owner's
// aliases are separate rows the client revokes (overwrites) before calling this.
func (s *Server) handleAccountDelete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !contract.ValidID(id) {
		s.writeError(w, http.StatusBadRequest, contract.ErrBadRequest, "malformed id")
		return
	}
	if !s.ipLimit.allow(clientIP(r), s.now()) {
		s.writeError(w, http.StatusTooManyRequests, contract.ErrRateLimited, "")
		return
	}
	if err := s.st.DeleteAccount(r.Context(), id); err != nil {
		s.writeError(w, http.StatusInternalServerError, contract.ErrInternal, "")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// --- Notify + push ----------------------------------------------------------

func (s *Server) handleNotify(w http.ResponseWriter, r *http.Request) {
	if !s.ipLimit.allow(clientIP(r), s.now()) {
		s.writeError(w, http.StatusTooManyRequests, contract.ErrRateLimited, "")
		return
	}
	var req contract.NotifyRequest
	if err := decodeJSON(r, &req); err != nil || req.TokenHash == "" {
		if err != nil {
			s.metrics.Error(metrics.ErrDecode)
		}
		s.writeError(w, http.StatusBadRequest, contract.ErrBadRequest, "")
		return
	}
	// Gated off by default: enqueue nothing unless targeted-wake delivery is on,
	// so the queue never builds (and so cannot flood when the gate flips). The
	// response is uniform either way.
	if s.cfg.NotifyEnabled {
		if ep, found, err := s.st.GetNotifyRoute(r.Context(), req.TokenHash); err == nil && found {
			// Jittered single-send: spread wake timing to decorrelate from the event.
			jitter := time.Duration(rand.Int64N(int64(s.cfg.SendMaxJitter) + 1))
			at := s.now() + jitter.Milliseconds()
			if err := s.st.EnqueueSend(r.Context(), ep, at, s.now()); err != nil {
				s.metrics.Error(metrics.ErrEnqueue)
				s.log.Error("enqueue send", "err", err)
			}
		} else if err != nil {
			s.metrics.Error(metrics.ErrStore)
		}
	}
	// Always 202, whether or not a route existed. The *response* is uniform, but a
	// found route enqueues a send while a miss does no work, so timing is not yet
	// equalized; constant-time work is a carried open item (doc 10 §F).
	w.WriteHeader(http.StatusAccepted)
}

func (s *Server) handlePushRegister(w http.ResponseWriter, r *http.Request) {
	if !s.ipLimit.allow(clientIP(r), s.now()) {
		s.writeError(w, http.StatusTooManyRequests, contract.ErrRateLimited, "")
		return
	}
	var req contract.PushRegisterRequest
	if err := decodeJSON(r, &req); err != nil || req.RoutingEndpointID == "" || req.Subscription.Endpoint == "" {
		if err != nil {
			s.metrics.Error(metrics.ErrDecode)
		}
		s.writeError(w, http.StatusBadRequest, contract.ErrBadRequest, "")
		return
	}
	t := store.PushTarget{
		Endpoint: req.Subscription.Endpoint,
		P256dh:   req.Subscription.Keys.P256dh,
		Auth:     req.Subscription.Keys.Auth,
	}
	if err := s.st.RegisterPush(r.Context(), req.RoutingEndpointID, t, s.now()); err != nil {
		s.writeError(w, http.StatusInternalServerError, contract.ErrInternal, "")
		return
	}
	// Make the device reachable for the notify that wakes it: map the notify token
	// hash to this routing endpoint so a later POST /notify resolves a route and
	// enqueues a send. The client sets both the notify token hash and the routing
	// endpoint id to hash(routingToken), so this is an identity route; keeping it in
	// notify_route leaves routing a single source of truth (not special-cased in
	// handleNotify). Without it a registered subscription would never be pushed to.
	if err := s.st.PutNotifyRoute(r.Context(), req.RoutingEndpointID, req.RoutingEndpointID); err != nil {
		s.writeError(w, http.StatusInternalServerError, contract.ErrInternal, "")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// --- Knock (contentless, existence-uniform) ---------------------------------

func (s *Server) handleKnock(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req contract.KnockRequest
	_ = decodeJSON(r, &req)
	// Record unconditionally for a well-formed (id, requester), whether or not the
	// alias exists, so the work is the same either way. The owner only ever reads
	// knocks for their own ids; knocks against non-existent ids are never read and
	// get purged. Over-limit is silent: it never becomes a visible 429.
	if contract.ValidID(id) && req.RequesterHash != "" {
		// Key per (id, requester) so a single flooder only exhausts its own bucket
		// and can't silently suppress other requesters' knocks for the same id.
		if s.knockLim.allow(id+"\x00"+req.RequesterHash, s.now()) {
			now := s.now()
			expires := now + s.cfg.KnockTTL.Milliseconds()
			// The grant key is opaque to us; drop anything malformed or over-bound
			// rather than reject (the knock must still answer uniformly). A dropped
			// key just means no in-app grant slot for this requester.
			pubKey := req.PubKey
			if !contract.ValidPubKey(pubKey) {
				pubKey = ""
			}
			if _, err := s.st.RecordKnock(r.Context(), id, req.RequesterHash, pubKey, now, expires); err != nil {
				s.metrics.Error(metrics.ErrStore)
				s.log.Error("record knock", "err", err)
			}
		}
	}
	// The single response, identical for every id.
	s.writeJSON(w, http.StatusOK, contract.KnockResponse{Status: contract.KnockStatus})
}

// handleKnockReview lets the alias OWNER read the count of current knocks on one
// of their aliases, authorized by the write token (the same capability that
// authorizes PUT). Unlike POST /knock this is NOT existence-uniform — but a wrong
// or missing token returns 403 for both a real and a nonexistent alias, so it
// still never reveals whether an alias exists to someone who lacks the token.
func (s *Server) handleKnockReview(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !contract.ValidID(id) {
		s.writeError(w, http.StatusBadRequest, contract.ErrBadRequest, "malformed id")
		return
	}
	if !s.ipLimit.allow(clientIP(r), s.now()) {
		s.writeError(w, http.StatusTooManyRequests, contract.ErrRateLimited, "")
		return
	}
	token := r.Header.Get(contract.HeaderWriteToken)
	if token == "" {
		s.writeError(w, http.StatusBadRequest, contract.ErrBadRequest, "missing write token")
		return
	}
	ok, err := s.st.VerifyAliasWrite(r.Context(), id, hashToken(token))
	if err != nil {
		s.writeError(w, http.StatusInternalServerError, contract.ErrInternal, "")
		return
	}
	if !ok {
		// Wrong token or no such alias: uniform 403, so existence stays hidden.
		s.writeError(w, http.StatusForbidden, contract.ErrBadRequest, "write token does not match")
		return
	}
	knocks, err := s.st.CurrentKnocks(r.Context(), id, s.now())
	if err != nil {
		s.writeError(w, http.StatusInternalServerError, contract.ErrInternal, "")
		return
	}
	pending := make([]contract.PendingKnock, len(knocks))
	for i, k := range knocks {
		pending[i] = contract.PendingKnock{RequesterHash: k.RequesterHash, PubKey: k.PubKey}
	}
	s.writeJSON(w, http.StatusOK, contract.KnockReviewResponse{Count: len(pending), Pending: pending})
}

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	s.writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// handleVapid serves the active Web Push public key so a browser can subscribe.
// Empty when push is not configured; the client reads that as "push unavailable".
func (s *Server) handleVapid(w http.ResponseWriter, _ *http.Request) {
	s.writeJSON(w, http.StatusOK, contract.VapidResponse{PublicKey: s.cfg.VAPIDPublicKey})
}

// handleRoot serves a small public landing page so api.sti.care is not a bare
// 404, and reinforces the privacy story. Nothing sensitive; safe to be public.
func (s *Server) handleRoot(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	_, _ = w.Write(landingHTML)
}

// --- helpers ----------------------------------------------------------------

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func decodeJSON(r *http.Request, v any) error {
	dec := json.NewDecoder(io.LimitReader(r.Body, 1<<16))
	return dec.Decode(v)
}

func (s *Server) writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func (s *Server) writeError(w http.ResponseWriter, status int, code, msg string) {
	s.writeJSON(w, status, contract.ErrorResponse{Error: contract.ErrorBody{Code: code, Message: msg}})
}

// clientIP returns the address the rate limiter keys on. The origin is reachable
// ONLY through the local Caddy reverse proxy, which sets X-Real-IP to the true
// client address and overwrites any client-supplied value. We therefore trust
// only that one header. We deliberately do NOT read X-Forwarded-For or
// CF-Connecting-IP: both are client-spoofable here (there is no Cloudflare), and
// trusting them would make the limit bypassable.
func clientIP(r *http.Request) string {
	if ip := r.Header.Get("X-Real-IP"); ip != "" {
		return ip
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// SweepLimiters drops idle rate-limit buckets (call periodically).
func (s *Server) SweepLimiters(now int64) {
	cutoff := now - (10 * time.Minute).Milliseconds()
	s.ipLimit.sweep(cutoff)
	s.knockLim.sweep(cutoff)
	s.adminLim.sweep(cutoff)
	s.uResolveLim.sweep(cutoff)
}

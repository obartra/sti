package server

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"math/rand/v2"
	"net/http"

	"sti.care/api/internal/contract"
	"sti.care/api/internal/metrics"
)

// republishMaxBody bounds the request body. A full batch carries RepublishMaxOps
// base64'd fixed-size ciphertexts plus per-op JSON overhead; size for that with
// slack so the shared 64 KiB JSON cap (decodeJSON) never truncates a legal batch.
const republishMaxBody = contract.RepublishMaxOps * (4*contract.AliasPayloadSize/3 + 512)

// Sibling-alias decorrelation (doc 11). An owner who reports a result republishes
// every shared card. Doing that as a same-instant client burst lets an observer
// watching two of the owner's aliases see them change together and link them. So
// the client hands the whole set to POST /republish, and the server APPLIES each
// alias write at an INDEPENDENT jittered time across RepublishWindow. The server
// receives the batch together (it is the blind-trusted party), but what a downstream
// observer of the public alias reads sees is decorrelated.
//
// A deferred write is no more powerful than a direct PUT /a: each op still carries
// the alias write token, gated the same way (first write binds, an overwrite must
// match), so /republish cannot touch an alias the caller does not already control.

// handleRepublish validates a decorrelation batch and queues each op at its own
// jittered apply time. The whole batch is rejected (400) if any op is malformed, so
// a partial apply can never happen. The response is uniform whether or not the ops
// name real aliases (existence is resolved only by the deferred write itself).
func (s *Server) handleRepublish(w http.ResponseWriter, r *http.Request) {
	if !s.ipLimit.allow(clientIP(r), s.now()) {
		s.writeError(w, http.StatusTooManyRequests, contract.ErrRateLimited, "")
		return
	}
	// A batch is larger than the shared 64 KiB JSON cap (each op carries a base64
	// fixed-size ciphertext), so decode against a batch-sized limit of its own.
	var req contract.RepublishRequest
	if err := json.NewDecoder(io.LimitReader(r.Body, republishMaxBody)).Decode(&req); err != nil {
		s.metrics.Error(metrics.ErrDecode)
		s.writeError(w, http.StatusBadRequest, contract.ErrBadRequest, "")
		return
	}
	if len(req.Ops) == 0 || len(req.Ops) > contract.RepublishMaxOps {
		s.writeError(w, http.StatusBadRequest, contract.ErrBadRequest, "batch size")
		return
	}
	// Validate every op up front so the batch is all-or-nothing.
	type pending struct {
		id        string
		ct        []byte
		writeAuth string
	}
	ops := make([]pending, len(req.Ops))
	for i, op := range req.Ops {
		ct, err := base64.RawURLEncoding.DecodeString(op.Ciphertext)
		if err != nil || !contract.ValidID(op.ID) || op.WriteToken == "" ||
			len(ct) != contract.AliasPayloadSize {
			s.writeError(w, http.StatusBadRequest, contract.ErrBadRequest, "malformed op")
			return
		}
		ops[i] = pending{id: op.ID, ct: ct, writeAuth: hashToken(op.WriteToken)}
	}
	// Queue each op at an independent jittered time. Window 0 (tests) applies now.
	now := s.now()
	window := s.cfg.RepublishWindow.Milliseconds()
	for _, op := range ops {
		at := now
		if window > 0 {
			at += rand.Int64N(window + 1)
		}
		if err := s.st.EnqueueRepublish(r.Context(), op.id, op.ct, op.writeAuth, at, now); err != nil {
			s.metrics.Error(metrics.ErrEnqueue)
			s.log.Error("enqueue republish", "err", err)
			s.writeError(w, http.StatusInternalServerError, contract.ErrInternal, "")
			return
		}
	}
	w.WriteHeader(http.StatusAccepted)
}

// DrainRepublishes applies every deferred overwrite whose jittered time has arrived.
// Unlike the wake drain it is NOT gated by NotifyEnabled: decorrelation is a
// first-class write path, always on. Each op is a write-token-gated alias overwrite;
// it is deleted once applied, or dropped if the token no longer matches (the alias
// was taken over or gone), so a stuck op never wedges the queue.
func (s *Server) DrainRepublishes(ctx context.Context, now int64) {
	due, err := s.st.DueRepublishes(ctx, now, drainBatch)
	if err != nil {
		s.metrics.Error(metrics.ErrJanitor)
		s.log.Error("due republishes", "err", err)
		return
	}
	for _, op := range due {
		// ApplyRepublish overwrites only when the alias still exists, the token
		// matches, and no newer write landed since the op was enqueued (op.CreatedAt),
		// so a stale snapshot can never revert a later edit or un-revoke a card. It
		// preserves the link's expiry and never recreates a deleted alias.
		if _, err := s.st.ApplyRepublish(ctx, op.AliasID, op.Ciphertext, op.WriteAuth, now, op.CreatedAt); err != nil {
			// Transient: leave it queued for the next pass.
			s.metrics.Error(metrics.ErrStore)
			s.log.Error("apply republish", "err", err)
			continue
		}
		// Applied, or intentionally skipped (token mismatch / alias gone / superseded
		// by a newer write): drop the queue row either way rather than retry a no-op.
		if err := s.st.DeleteRepublish(ctx, op.ID); err != nil {
			s.metrics.Error(metrics.ErrJanitor)
			s.log.Error("delete republish", "err", err)
		}
	}
}

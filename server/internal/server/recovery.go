package server

import (
	"io"
	"net/http"

	"sti.care/api/internal/contract"
	"sti.care/api/internal/vanityname"
)

// The password-recovery envelope endpoints (doc 32). A new device with only the
// owner's recovery name (the locator) and password fetches the envelope by locator
// and opens it with the password to recover the account root. The server stays
// blind: it stores one fixed-size opaque blob per locator and never sees the
// password or anything derived from it.
//
// The read is existence-uniform (a decoy of the same fixed size on a miss), so a
// short, human-chosen locator is not an existence oracle. Writes and deletes are
// gated by the account write token and answer uniformly (204) whether the locator
// was free, owned by the caller, or held by someone else, so the write path reveals
// nothing about which locators are taken either.

// recoveryLocator normalizes and shape-validates a locator. It shares the vanity
// name charset ([a-z0-9_]{3,30}) but not its reserved/blocklist rules: a locator
// names a private envelope, not a public directory entry, so only its shape matters
// (doc 32, "validated for shape only").
func recoveryLocator(raw string) (string, bool) {
	name := vanityname.Normalize(raw)
	return name, vanityname.ValidFormat(name)
}

// handleRecoveryGet answers GET /recovery/{locator}: the envelope bytes if the
// locator is registered, otherwise a decoy of the same fixed size. A malformed
// locator or a rate-limited caller never reaches the store; both stay independent
// of whether any locator exists.
func (s *Server) handleRecoveryGet(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Cache-Control", "no-store")
	// Per-IP slows one harvester; the global bucket caps a distributed sweep of the
	// (guessable) namespace. A 429 is existence-independent, so it leaks no locator.
	if !s.ipLimit.allow(clientIP(r), s.now()) ||
		!s.recoveryLim.allow("recovery", s.now()) {
		s.writeError(w, http.StatusTooManyRequests, contract.ErrRateLimited, "")
		return
	}
	_, _ = w.Write(s.recoveryPayload(r, r.PathValue("locator")))
}

// recoveryPayload always returns exactly RecoveryEnvelopeSize bytes: the stored
// envelope if the locator resolves, otherwise a deterministic decoy. The decoy is
// computed unconditionally so a hit pays the same HMAC cost as a miss, closing the
// existence-timing oracle (the same discipline as aliasPayload).
func (s *Server) recoveryPayload(r *http.Request, rawLocator string) []byte {
	locator, ok := recoveryLocator(rawLocator)
	decoy := decoyBytes(s.cfg.DecoySecret, locator, contract.RecoveryEnvelopeSize)
	if ok {
		if ct, found, err := s.st.GetRecoveryEnvelope(r.Context(), locator); err != nil {
			s.log.Error("recovery get", "err", err)
		} else if found && len(ct) == contract.RecoveryEnvelopeSize {
			return ct
		}
	}
	return decoy
}

// handleRecoveryPut answers PUT /recovery/{locator}: store or replace the owner's
// envelope. The body must be exactly the fixed size, and the account write token
// authorizes the write. The response is a uniform 204 whether the write created,
// overwrote, or was a silent no-op on a locator held by someone else.
func (s *Server) handleRecoveryPut(w http.ResponseWriter, r *http.Request) {
	locator, ok := recoveryLocator(r.PathValue("locator"))
	if !ok {
		s.writeError(w, http.StatusBadRequest, contract.ErrBadRequest, "recovery name must be lowercase a-z, 0-9 or _ and 3-30 characters")
		return
	}
	if !s.ipLimit.allow(clientIP(r), s.now()) ||
		!s.recoveryLim.allow("recovery", s.now()) {
		s.writeError(w, http.StatusTooManyRequests, contract.ErrRateLimited, "")
		return
	}
	body, err := io.ReadAll(io.LimitReader(r.Body, contract.RecoveryEnvelopeSize+1))
	if err != nil {
		s.writeError(w, http.StatusBadRequest, contract.ErrBadRequest, "read body")
		return
	}
	if len(body) != contract.RecoveryEnvelopeSize {
		s.writeError(w, http.StatusBadRequest, contract.ErrBadRequest, "payload must be exactly the fixed size")
		return
	}
	token := r.Header.Get(contract.HeaderWriteToken)
	if token == "" {
		s.writeError(w, http.StatusBadRequest, contract.ErrBadRequest, "missing write token")
		return
	}
	if err := s.st.PutRecoveryEnvelope(r.Context(), locator, body, hashToken(token), s.now()); err != nil {
		s.writeError(w, http.StatusInternalServerError, contract.ErrInternal, "")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// handleRecoveryDelete answers DELETE /recovery/{locator}: turn the password off by
// dropping the envelope. Authorized by the account write token; a missing row or a
// mismatched token is a silent no-op, so the response is a uniform 204 either way
// and reveals nothing about which locators exist.
func (s *Server) handleRecoveryDelete(w http.ResponseWriter, r *http.Request) {
	locator, ok := recoveryLocator(r.PathValue("locator"))
	if !ok {
		s.writeError(w, http.StatusBadRequest, contract.ErrBadRequest, "malformed recovery name")
		return
	}
	if !s.ipLimit.allow(clientIP(r), s.now()) ||
		!s.recoveryLim.allow("recovery", s.now()) {
		s.writeError(w, http.StatusTooManyRequests, contract.ErrRateLimited, "")
		return
	}
	token := r.Header.Get(contract.HeaderWriteToken)
	if token == "" {
		s.writeError(w, http.StatusBadRequest, contract.ErrBadRequest, "missing write token")
		return
	}
	if err := s.st.DeleteRecoveryEnvelope(r.Context(), locator, hashToken(token)); err != nil {
		s.writeError(w, http.StatusInternalServerError, contract.ErrInternal, "")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

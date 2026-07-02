package server

import (
	"io"
	"net/http"

	"sti.care/api/internal/contract"
	"sti.care/api/internal/metrics"
)

// The shared-group blob endpoints (doc 33, slice 2). A group object (its handle, a
// roster of per-member entries, and the per-member wrapped group key Kg) is sealed
// client-side and stored as one fixed-size opaque blob at an opaque group id. An
// admin writes it; members read it to poll for roster and key changes.
//
// The blob is stored and read EXACTLY like an alias payload, which is the whole
// point of slice 2: it must add NO oracle the alias store does not already have
// (doc 33 decision 1). So this reuses the same primitives verbatim:
//
//   - GET is existence-uniform: a stored id and a never-written id return the same
//     fixed size (GroupBlobSize), and the decoy is computed unconditionally so a hit
//     pays the same HMAC cost as a miss (the alias read discipline). GET /g is in
//     sensitivePath, so under load it rides the uniform decoy fallback, never a
//     visible 429/503.
//   - PUT is write-token gated via writeFixed (the alias/inbox store primitive): the
//     first write binds hash(token) as the blob's capability, and only a matching
//     token overwrites. A wrong token is a 403, exactly like the alias/inbox PUT.
//     That 403 is the SAME oracle the alias store already exposes on an unguessable
//     256-bit id (holding the id already implies you may learn it exists), so it is
//     not a NEW oracle.
//   - DELETE is write-token gated the same way (403 on a wrong token), mirroring the
//     account-blob delete; a missing row is an idempotent 204.

// handleGroupGet answers GET /g/{id}: the stored blob if the id resolves, otherwise
// a decoy of the same fixed size. Existence-uniform, byte-for-byte like GET /a.
func (s *Server) handleGroupGet(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Cache-Control", "no-store")
	_, _ = w.Write(s.groupPayload(r, r.PathValue("id")))
}

// groupPayload always returns exactly GroupBlobSize bytes: the stored blob if it
// resolves, otherwise a deterministic decoy. The decoy is computed unconditionally
// so a hit pays the same HMAC cost as a miss, closing the existence-timing oracle
// (the same discipline as aliasPayload/recoveryPayload).
func (s *Server) groupPayload(r *http.Request, id string) []byte {
	decoy := decoyBytes(s.cfg.DecoySecret, id, contract.GroupBlobSize)
	if contract.ValidID(id) {
		if ct, found, err := s.st.GetGroupBlob(r.Context(), id); err != nil {
			s.metrics.Error(metrics.ErrStore)
			s.log.Error("group get", "err", err)
		} else if found && len(ct) == contract.GroupBlobSize {
			return ct
		}
	}
	return decoy
}

// handleGroupPut answers PUT /g/{id}: store or replace the group blob. The body must
// be exactly the fixed size, and the write token authorizes the write (writeFixed
// binds it on the first write). A wrong token is a 403, like the alias/inbox PUT.
func (s *Server) handleGroupPut(w http.ResponseWriter, r *http.Request) {
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
	body, err := io.ReadAll(io.LimitReader(r.Body, contract.GroupBlobSize+1))
	if err != nil {
		s.writeError(w, http.StatusBadRequest, contract.ErrBadRequest, "read body")
		return
	}
	if len(body) != contract.GroupBlobSize {
		// The client pre-pads the blob to exactly the fixed size.
		s.writeError(w, http.StatusBadRequest, contract.ErrBadRequest, "payload must be exactly the fixed size")
		return
	}
	ok, err := s.st.WriteGroupBlob(r.Context(), id, body, hashToken(token), s.now())
	if err != nil {
		s.writeError(w, http.StatusInternalServerError, contract.ErrInternal, "")
		return
	}
	if !ok {
		// Exists under a different token: 403, exactly like the alias/inbox PUT. The
		// id is an unguessable 256-bit value, so this leaks nothing a write-token
		// holder did not already know (no new oracle beyond the alias store).
		s.writeError(w, http.StatusForbidden, contract.ErrBadRequest, "write token does not match")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// handleGroupDelete answers DELETE /g/{id}: drop the group blob. Authorized by the
// write token (a wrong token is a 403; a missing row is an idempotent 204),
// mirroring the account-blob delete. After a delete the id reads back as a decoy,
// exactly like a never-written id.
func (s *Server) handleGroupDelete(w http.ResponseWriter, r *http.Request) {
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
	ok, err := s.st.DeleteGroupBlob(r.Context(), id, hashToken(token))
	if err != nil {
		s.writeError(w, http.StatusInternalServerError, contract.ErrInternal, "")
		return
	}
	if !ok {
		s.writeError(w, http.StatusForbidden, contract.ErrBadRequest, "write token does not match")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

package server

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"sti.care/api/internal/contract"
	"sti.care/api/internal/store"
)

// newRecoveryServer builds a server with the recovery envelope endpoints enabled.
func newRecoveryServer(t *testing.T) (http.Handler, *store.Store) {
	t.Helper()
	srv, st := newServer(t, Config{RecoveryEnabled: true}, nil)
	return srv.Handler(), st
}

func envelopeBody() []byte { return bytes.Repeat([]byte{0xCD}, contract.RecoveryEnvelopeSize) }

func putEnvelope(h http.Handler, locator, token string, body []byte) *httptest.ResponseRecorder {
	req := httptest.NewRequest("PUT", contract.PathRecoveryPrefix+locator, bytes.NewReader(body))
	if token != "" {
		req.Header.Set(contract.HeaderWriteToken, token)
	}
	return do(h, req)
}

func getEnvelope(h http.Handler, locator string) *httptest.ResponseRecorder {
	return do(h, httptest.NewRequest("GET", contract.PathRecoveryPrefix+locator, nil))
}

// The happy path: store an envelope, then fetch it back byte-for-byte. The locator
// is normalized (an uppercase request fetches the same row).
func TestRecoveryPutThenGet(t *testing.T) {
	h, _ := newRecoveryServer(t)
	body := envelopeBody()

	if rec := putEnvelope(h, "meow", "acct-token", body); rec.Code != http.StatusNoContent {
		t.Fatalf("put: %d", rec.Code)
	}
	rec := getEnvelope(h, "MEOW") // normalized before lookup
	if rec.Code != http.StatusOK {
		t.Fatalf("get: %d", rec.Code)
	}
	if !bytes.Equal(rec.Body.Bytes(), body) {
		t.Fatalf("get returned %d bytes, not the stored envelope", rec.Body.Len())
	}
}

// A miss returns a decoy of exactly the fixed size (never a 404), so a stored
// envelope and a never-registered locator are indistinguishable on the wire.
func TestRecoveryGetMissIsFixedSizeDecoy(t *testing.T) {
	h, _ := newRecoveryServer(t)
	rec := getEnvelope(h, "nobodyhome")
	if rec.Code != http.StatusOK {
		t.Fatalf("miss code: %d, want 200 (uniform)", rec.Code)
	}
	if rec.Body.Len() != contract.RecoveryEnvelopeSize {
		t.Fatalf("decoy is %d bytes, want %d", rec.Body.Len(), contract.RecoveryEnvelopeSize)
	}
	// The decoy is stable for a locator (a repeat miss returns identical bytes, as a
	// real stored envelope would), so a repeat read leaks nothing by changing.
	rec2 := getEnvelope(h, "nobodyhome")
	if !bytes.Equal(rec.Body.Bytes(), rec2.Body.Bytes()) {
		t.Fatal("decoy for a locator changed between reads")
	}
}

// A wrong-sized body is rejected before it can reach the store, so the fixed-size
// decoy invariant holds for every stored row.
func TestRecoveryPutRejectsWrongSize(t *testing.T) {
	h, _ := newRecoveryServer(t)
	if rec := putEnvelope(h, "meow", "acct-token", []byte("too short")); rec.Code != http.StatusBadRequest {
		t.Fatalf("short body: %d, want 400", rec.Code)
	}
	over := bytes.Repeat([]byte{1}, contract.RecoveryEnvelopeSize+1)
	if rec := putEnvelope(h, "meow", "acct-token", over); rec.Code != http.StatusBadRequest {
		t.Fatalf("over-size body: %d, want 400", rec.Code)
	}
}

// A malformed locator and a missing write token are rejected; both are request-shape
// errors independent of whether any locator exists, so they leak nothing.
func TestRecoveryPutValidatesRequest(t *testing.T) {
	h, _ := newRecoveryServer(t)
	if rec := putEnvelope(h, "no", "acct-token", envelopeBody()); rec.Code != http.StatusBadRequest {
		t.Fatalf("too-short locator: %d, want 400", rec.Code)
	}
	if rec := putEnvelope(h, "meow", "", envelopeBody()); rec.Code != http.StatusBadRequest {
		t.Fatalf("missing token: %d, want 400", rec.Code)
	}
}

// A collision (a second account writing an already-held locator) returns the same
// uniform 204 as any write and does NOT overwrite the owner's envelope, so the write
// path is not an existence oracle and no one can clobber another's envelope.
func TestRecoveryPutCollisionIsUniformAndSafe(t *testing.T) {
	h, _ := newRecoveryServer(t)
	owner := envelopeBody()
	if rec := putEnvelope(h, "meow", "owner-token", owner); rec.Code != http.StatusNoContent {
		t.Fatalf("owner put: %d", rec.Code)
	}
	other := bytes.Repeat([]byte{0x11}, contract.RecoveryEnvelopeSize)
	// Same uniform 204 as a fresh write, even though the locator is taken.
	if rec := putEnvelope(h, "meow", "other-token", other); rec.Code != http.StatusNoContent {
		t.Fatalf("colliding put: %d, want 204 (uniform)", rec.Code)
	}
	// The owner's envelope is untouched.
	if rec := getEnvelope(h, "meow"); !bytes.Equal(rec.Body.Bytes(), owner) {
		t.Fatal("a colliding write overwrote the owner's envelope")
	}
}

// Delete drops the envelope for the binding owner (a later read falls back to a
// decoy) and is a uniform 204 no-op for a wrong token, so it never reveals existence.
func TestRecoveryDelete(t *testing.T) {
	h, _ := newRecoveryServer(t)
	body := envelopeBody()
	if rec := putEnvelope(h, "meow", "owner-token", body); rec.Code != http.StatusNoContent {
		t.Fatalf("put: %d", rec.Code)
	}

	del := func(token string) int {
		req := httptest.NewRequest("DELETE", contract.PathRecoveryPrefix+"meow", nil)
		if token != "" {
			req.Header.Set(contract.HeaderWriteToken, token)
		}
		return do(h, req).Code
	}

	// Wrong token: uniform 204, but the envelope survives.
	if code := del("wrong-token"); code != http.StatusNoContent {
		t.Fatalf("mismatched delete: %d, want 204", code)
	}
	if rec := getEnvelope(h, "meow"); !bytes.Equal(rec.Body.Bytes(), body) {
		t.Fatal("mismatched delete removed the envelope")
	}
	// Right token: gone, so the read now returns a decoy (not the stored bytes).
	if code := del("owner-token"); code != http.StatusNoContent {
		t.Fatalf("owner delete: %d", code)
	}
	if rec := getEnvelope(h, "meow"); bytes.Equal(rec.Body.Bytes(), body) {
		t.Fatal("owner delete did not remove the envelope")
	}
}

// The endpoints are gated: with recovery disabled they are a bare 404 (the surface
// is invisible), so nothing can be stored or fetched pre-launch.
func TestRecoveryDisabledIsNotFound(t *testing.T) {
	srv, _ := newServer(t, Config{}, nil)
	h := srv.Handler()
	if rec := getEnvelope(h, "meow"); rec.Code != http.StatusNotFound {
		t.Fatalf("disabled GET: %d, want 404", rec.Code)
	}
	if rec := putEnvelope(h, "meow", "t", envelopeBody()); rec.Code != http.StatusNotFound {
		t.Fatalf("disabled PUT: %d, want 404", rec.Code)
	}
}

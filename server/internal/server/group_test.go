package server

import (
	"bytes"
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"sti.care/api/internal/contract"
	"sti.care/api/internal/store"
)

// blobBody is a full-size group blob filled with a constant byte, so a test can put
// it and assert an exact round trip.
func groupBlob(fill byte) []byte { return bytes.Repeat([]byte{fill}, contract.GroupBlobSize) }

func putGroup(h http.Handler, id, token string, body []byte) *httptest.ResponseRecorder {
	req := httptest.NewRequest("PUT", contract.PathGroupPrefix+id, bytes.NewReader(body))
	if token != "" {
		req.Header.Set(contract.HeaderWriteToken, token)
	}
	return do(h, req)
}

func getGroup(h http.Handler, id string) *httptest.ResponseRecorder {
	return do(h, httptest.NewRequest("GET", contract.PathGroupPrefix+id, nil))
}

// The happy path: store a group blob, then fetch it back byte-for-byte.
func TestGroupPutThenGet(t *testing.T) {
	h := newTestServer(t)
	id := randID(t)
	body := groupBlob(0xA5)

	if rec := putGroup(h, id, "admin-token", body); rec.Code != http.StatusNoContent {
		t.Fatalf("put: %d", rec.Code)
	}
	rec := getGroup(h, id)
	if rec.Code != http.StatusOK {
		t.Fatalf("get: %d", rec.Code)
	}
	if !bytes.Equal(rec.Body.Bytes(), body) {
		t.Fatalf("get returned %d bytes, not the stored blob", rec.Body.Len())
	}
}

// The "no new oracle" proof (doc 33 decision 1): a GET of a stored id and a GET of a
// never-written id are byte-shape identical (both exactly GroupBlobSize, same status)
// and a miss is stable across repeats and distinct per id, exactly like GET /a. This
// is what makes "this group exists" undetectable from the read.
func TestGroupReadIsExistenceUniform(t *testing.T) {
	h := newTestServer(t)
	real := randID(t)
	missing := randID(t)

	if rec := putGroup(h, real, "admin-token", groupBlob(0x11)); rec.Code != http.StatusNoContent {
		t.Fatalf("put: %d", rec.Code)
	}

	hit := getGroup(h, real)
	miss := getGroup(h, missing)

	if hit.Code != miss.Code || hit.Code != http.StatusOK {
		t.Fatalf("status differs: hit=%d miss=%d", hit.Code, miss.Code)
	}
	if hit.Body.Len() != miss.Body.Len() || hit.Body.Len() != contract.GroupBlobSize {
		t.Fatalf("length differs: hit=%d miss=%d want=%d", hit.Body.Len(), miss.Body.Len(), contract.GroupBlobSize)
	}
	// A repeated miss is byte-stable, exactly as a real stored blob would be.
	miss2 := getGroup(h, missing)
	if !bytes.Equal(miss.Body.Bytes(), miss2.Body.Bytes()) {
		t.Fatal("decoy not stable across repeats")
	}
	// Different missing ids get different decoys.
	other := getGroup(h, randID(t))
	if bytes.Equal(miss.Body.Bytes(), other.Body.Bytes()) {
		t.Fatal("decoys collide across ids")
	}
}

// Existence-timing uniformity (doc 02: uniformity is shape AND timing): a hit must
// compute the decoy too, so it pays the same HMAC cost as a miss. Mirrors the alias
// read timing test. A refactor that returns stored bytes BEFORE computing the decoy
// drops the hit-path count to 0 and turns this red.
func TestGroupReadComputesDecoyOnHitAndMiss(t *testing.T) {
	h := newTestServer(t)
	real := randID(t)
	missing := randID(t)
	body := groupBlob(0x22)

	if rec := putGroup(h, real, "admin-token", body); rec.Code != http.StatusNoContent {
		t.Fatalf("put: %d", rec.Code)
	}

	var computes int
	decoyComputeHook = func() { computes++ }
	t.Cleanup(func() { decoyComputeHook = nil })

	computes = 0
	hitBody := getGroup(h, real).Body.Bytes()
	hitComputes := computes
	if !bytes.Equal(hitBody, body) {
		t.Fatal("hit did not return the stored blob")
	}

	computes = 0
	getGroup(h, missing)
	missComputes := computes

	if hitComputes != missComputes {
		t.Fatalf("decoy computed %d times on a hit, %d on a miss; a hit must pay the same HMAC cost",
			hitComputes, missComputes)
	}
	if hitComputes != 1 {
		t.Fatalf("expected exactly one decoy compute per read, got %d", hitComputes)
	}
}

// A wrong-sized body is rejected before it can reach the store, so the fixed-size
// decoy invariant holds for every stored row.
func TestGroupPutRejectsWrongSize(t *testing.T) {
	h := newTestServer(t)
	id := randID(t)
	if rec := putGroup(h, id, "admin-token", []byte("too short")); rec.Code != http.StatusBadRequest {
		t.Fatalf("short body: %d, want 400", rec.Code)
	}
	over := bytes.Repeat([]byte{1}, contract.GroupBlobSize+1)
	if rec := putGroup(h, id, "admin-token", over); rec.Code != http.StatusBadRequest {
		t.Fatalf("over-size body: %d, want 400", rec.Code)
	}
}

// A malformed id and a missing write token are rejected on write; a malformed id
// still reads back as a fixed-size decoy (never a 400 on the GET), so the read stays
// existence-uniform. All are request-shape outcomes independent of existence.
func TestGroupValidatesRequest(t *testing.T) {
	h := newTestServer(t)
	id := randID(t)
	if rec := putGroup(h, "not-a-valid-id", "admin-token", groupBlob(0x33)); rec.Code != http.StatusBadRequest {
		t.Fatalf("malformed id put: %d, want 400", rec.Code)
	}
	if rec := putGroup(h, id, "", groupBlob(0x33)); rec.Code != http.StatusBadRequest {
		t.Fatalf("missing token: %d, want 400", rec.Code)
	}
	// A malformed id on GET falls through to a fixed-size decoy, never a 400.
	rec := getGroup(h, "not-a-valid-id")
	if rec.Code != http.StatusOK || rec.Body.Len() != contract.GroupBlobSize {
		t.Fatalf("malformed id get: code=%d len=%d", rec.Code, rec.Body.Len())
	}
}

// The other half of the "no new oracle" proof: a wrong or absent write token cannot
// overwrite or delete the blob (writeFixed semantics). A mismatched write is a 403
// and the stored blob is untouched; a mismatched delete is a 403 and the blob
// survives; only the binding owner can overwrite or delete.
func TestGroupWriteTokenEnforced(t *testing.T) {
	h := newTestServer(t)
	id := randID(t)
	owner := groupBlob(0x44)
	if rec := putGroup(h, id, "owner-token", owner); rec.Code != http.StatusNoContent {
		t.Fatalf("owner put: %d", rec.Code)
	}

	// A wrong token cannot overwrite: 403, and the stored blob is unchanged.
	if rec := putGroup(h, id, "not-owner", groupBlob(0x99)); rec.Code != http.StatusForbidden {
		t.Fatalf("wrong-token overwrite: %d, want 403", rec.Code)
	}
	if rec := getGroup(h, id); !bytes.Equal(rec.Body.Bytes(), owner) {
		t.Fatal("a wrong-token write overwrote the owner's blob")
	}

	// A wrong token cannot delete: 403, and the blob survives.
	del := func(token string) int {
		req := httptest.NewRequest("DELETE", contract.PathGroupPrefix+id, nil)
		if token != "" {
			req.Header.Set(contract.HeaderWriteToken, token)
		}
		return do(h, req).Code
	}
	if code := del("not-owner"); code != http.StatusForbidden {
		t.Fatalf("wrong-token delete: %d, want 403", code)
	}
	if rec := getGroup(h, id); !bytes.Equal(rec.Body.Bytes(), owner) {
		t.Fatal("a wrong-token delete removed the owner's blob")
	}

	// The owner overwrites, then deletes; after the delete the id reads as a decoy.
	updated := groupBlob(0x55)
	if rec := putGroup(h, id, "owner-token", updated); rec.Code != http.StatusNoContent {
		t.Fatalf("owner overwrite: %d", rec.Code)
	}
	if rec := getGroup(h, id); !bytes.Equal(rec.Body.Bytes(), updated) {
		t.Fatal("owner overwrite did not land")
	}
	if code := del("owner-token"); code != http.StatusNoContent {
		t.Fatalf("owner delete: %d, want 204", code)
	}
	if rec := getGroup(h, id); bytes.Equal(rec.Body.Bytes(), updated) {
		t.Fatal("owner delete did not remove the blob")
	}
}

// The group namespace is independent of alias/inbox: writing an id as an alias does
// not make it readable as a group blob (it reads back as a decoy, not the alias
// ciphertext), and the sizes differ, so the two can never be confused.
func TestGroupNamespaceIsSeparate(t *testing.T) {
	h := newTestServer(t)
	id := randID(t)
	aliasPayload := bytes.Repeat([]byte{0x66}, contract.AliasPayloadSize)
	put := httptest.NewRequest("PUT", contract.PathAliasPrefix+id, bytes.NewReader(aliasPayload))
	put.Header.Set(contract.HeaderWriteToken, "tok")
	if rec := do(h, put); rec.Code != http.StatusNoContent {
		t.Fatalf("alias put: %d", rec.Code)
	}
	// The same id on /g is a miss -> a GroupBlobSize decoy, never the alias ciphertext.
	rec := getGroup(h, id)
	if rec.Code != http.StatusOK || rec.Body.Len() != contract.GroupBlobSize {
		t.Fatalf("group read of an alias id: code=%d len=%d", rec.Code, rec.Body.Len())
	}
	if bytes.Contains(rec.Body.Bytes(), aliasPayload) {
		t.Fatal("group read leaked the alias ciphertext for a shared id")
	}
}

// The catastrophic-overload fallback for GET /g MUST be byte-identical to a normal
// miss, or saturation becomes a distinguishable existence signal. GET /g is in
// sensitivePath, so it rides uniformOverload under load; this pins that its decoy
// (GroupBlobSize, keyed by the bare id) matches the normal-miss decoy.
func TestGroupOverloadDecoyMatchesMiss(t *testing.T) {
	st, err := store.Open(context.Background(), filepath.Join(t.TempDir(), "t.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	secret := bytes.Repeat([]byte{0x42}, 32)
	srv := New(st, Config{DecoySecret: secret}, slog.New(slog.NewTextHandler(io.Discard, nil)), nil)
	h := srv.Handler()
	id := randID(t)

	canonical := decoyBytes(secret, id, contract.GroupBlobSize)

	// A normal miss through the handler.
	miss := getGroup(h, id)
	if miss.Body.Len() != contract.GroupBlobSize || !bytes.Equal(miss.Body.Bytes(), canonical) {
		t.Fatalf("group normal miss != canonical decoy (len=%d)", miss.Body.Len())
	}

	// The overload fallback for the same id+path.
	rec := httptest.NewRecorder()
	srv.uniformOverload(rec, httptest.NewRequest("GET", contract.PathGroupPrefix+id, nil))
	if !bytes.Equal(rec.Body.Bytes(), canonical) {
		t.Fatal("group overload decoy != canonical (distinguishable from a miss)")
	}
}

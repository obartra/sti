package server

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"testing"

	"sti.care/api/internal/contract"
	"sti.care/api/internal/store"
)

func newTestServer(t *testing.T) http.Handler {
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
	srv := New(st, Config{DecoySecret: secret}, slog.New(slog.NewTextHandler(io.Discard, nil)), nil)
	return srv.Handler()
}

func randID(t *testing.T) string {
	t.Helper()
	b := make([]byte, contract.IDRandomBytes)
	if _, err := rand.Read(b); err != nil {
		t.Fatal(err)
	}
	return base64.RawURLEncoding.EncodeToString(b)
}

func do(h http.Handler, req *http.Request) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestAliasWriteThenRead(t *testing.T) {
	h := newTestServer(t)
	id := randID(t)
	payload := bytes.Repeat([]byte{0xAB}, contract.AliasPayloadSize)

	put := httptest.NewRequest("PUT", contract.PathAliasPrefix+id, bytes.NewReader(payload))
	put.Header.Set(contract.HeaderWriteToken, "owner-token")
	if rec := do(h, put); rec.Code != http.StatusNoContent {
		t.Fatalf("put: %d", rec.Code)
	}

	rec := do(h, httptest.NewRequest("GET", contract.PathAliasPrefix+id, nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("get: %d", rec.Code)
	}
	if got := rec.Body.Bytes(); !bytes.Equal(got, payload) {
		t.Fatalf("payload mismatch (len %d)", len(got))
	}
}

// An alias with a server-stored expiry (doc 16) resolves before its instant and
// returns a decoy after, the SAME response a missing id gets, so an expired link
// stops resolving on time. A republish (PUT with no expiry header) preserves the
// expiry; an explicit "none" clears it.
func TestAliasExpiryServerEnforced(t *testing.T) {
	clock := int64(1_000_000)
	st, err := store.Open(context.Background(), filepath.Join(t.TempDir(), "t.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	secret := make([]byte, 32)
	for i := range secret {
		secret[i] = byte(i + 1)
	}
	srv := New(st, Config{DecoySecret: secret}, slog.New(slog.NewTextHandler(io.Discard, nil)),
		func() int64 { return clock })
	h := srv.Handler()

	id := randID(t)
	payload := bytes.Repeat([]byte{0xCD}, contract.AliasPayloadSize)
	putWithExpiry := func(expiry string) {
		put := httptest.NewRequest("PUT", contract.PathAliasPrefix+id, bytes.NewReader(payload))
		put.Header.Set(contract.HeaderWriteToken, "owner-token")
		if expiry != "" {
			put.Header.Set(contract.HeaderExpiresAt, expiry)
		}
		if rec := do(h, put); rec.Code != http.StatusNoContent {
			t.Fatalf("put (expiry=%q): %d", expiry, rec.Code)
		}
	}
	resolves := func() bool {
		rec := do(h, httptest.NewRequest("GET", contract.PathAliasPrefix+id, nil))
		if rec.Code != http.StatusOK || len(rec.Body.Bytes()) != contract.AliasPayloadSize {
			t.Fatalf("get: code %d len %d", rec.Code, len(rec.Body.Bytes()))
		}
		return bytes.Equal(rec.Body.Bytes(), payload)
	}

	putWithExpiry(strconv.FormatInt(clock+1000, 10))
	if !resolves() {
		t.Fatal("before expiry: link should resolve to the real payload")
	}
	clock += 2000 // past the expiry
	if resolves() {
		t.Fatal("after expiry: link should return a decoy, not the payload")
	}
	// "Reads as the same blank decoy as a link that never existed": the body is
	// exactly this id's deterministic decoy, byte for byte, not merely "not the
	// payload". That equality is what makes an expired link indistinguishable from
	// one that was never created (the promises page leans on this).
	expired := do(h, httptest.NewRequest("GET", contract.PathAliasPrefix+id, nil)).Body.Bytes()
	if !bytes.Equal(expired, decoyBytes(secret, id, contract.AliasPayloadSize)) {
		t.Fatal("after expiry: body must equal this id's decoy, byte for byte")
	}
	// A republish (no expiry header) must not resurrect the link.
	putWithExpiry("")
	if resolves() {
		t.Fatal("republish must preserve the (passed) expiry, not clear it")
	}
	// Clearing the expiry brings it back even though the old instant has passed.
	putWithExpiry(contract.ExpiresAtNone)
	if !resolves() {
		t.Fatal("clearing expiry should make the link resolve again")
	}
}

// A malformed expiry header is rejected rather than silently ignored.
func TestAliasExpiryRejectsMalformed(t *testing.T) {
	h := newTestServer(t)
	put := httptest.NewRequest("PUT", contract.PathAliasPrefix+randID(t),
		bytes.NewReader(bytes.Repeat([]byte{0x01}, contract.AliasPayloadSize)))
	put.Header.Set(contract.HeaderWriteToken, "owner-token")
	put.Header.Set(contract.HeaderExpiresAt, "soon")
	if rec := do(h, put); rec.Code != http.StatusBadRequest {
		t.Fatalf("malformed expiry: got %d, want 400", rec.Code)
	}
}

// The owner reads the count of current knocks on their alias with the write
// token; everyone else (wrong token, no token, nonexistent alias) gets 403, so
// the count is owner-only and alias existence stays hidden.
func TestKnockReviewByOwner(t *testing.T) {
	h := newTestServer(t)
	id := randID(t)
	payload := bytes.Repeat([]byte{0xAB}, contract.AliasPayloadSize)
	put := httptest.NewRequest("PUT", contract.PathAliasPrefix+id, bytes.NewReader(payload))
	put.Header.Set(contract.HeaderWriteToken, "owner-token")
	if rec := do(h, put); rec.Code != http.StatusNoContent {
		t.Fatalf("put: %d", rec.Code)
	}

	review := func(token string) *httptest.ResponseRecorder {
		req := httptest.NewRequest("GET", contract.PathKnockPrefix+id, nil)
		if token != "" {
			req.Header.Set(contract.HeaderWriteToken, token)
		}
		return do(h, req)
	}
	count := func(token string) int {
		rec := review(token)
		if rec.Code != http.StatusOK {
			t.Fatalf("review: code %d", rec.Code)
		}
		var got contract.KnockReviewResponse
		if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
			t.Fatalf("decode: %v", err)
		}
		return got.Count
	}

	pending := func(token string) []contract.PendingKnock {
		rec := review(token)
		if rec.Code != http.StatusOK {
			t.Fatalf("review: code %d", rec.Code)
		}
		var got contract.KnockReviewResponse
		if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
			t.Fatalf("decode: %v", err)
		}
		if got.Count != len(got.Pending) {
			t.Fatalf("count %d != len(pending) %d", got.Count, len(got.Pending))
		}
		return got.Pending
	}

	if n := count("owner-token"); n != 0 {
		t.Fatalf("initial count = %d, want 0", n)
	}
	// Two distinct requesters knock; a repeat from one is deduped. req-a carries an
	// ephemeral grant key, req-b knocks contentless (no key).
	knocks := []contract.KnockRequest{
		{RequesterHash: "req-a", PubKey: "grantKeyA"},
		{RequesterHash: "req-b"},
		{RequesterHash: "req-a", PubKey: "grantKeyA"},
	}
	for _, k := range knocks {
		body, _ := json.Marshal(k)
		if rec := do(h, httptest.NewRequest("POST", contract.PathKnockPrefix+id, bytes.NewReader(body))); rec.Code != http.StatusOK {
			t.Fatalf("knock: %d", rec.Code)
		}
	}
	if n := count("owner-token"); n != 2 {
		t.Fatalf("count after knocks = %d, want 2", n)
	}
	// The owner sees each waiting requester's opaque key so it can seal a grant.
	got := pending("owner-token")
	keys := map[string]string{}
	for _, p := range got {
		keys[p.RequesterHash] = p.PubKey
	}
	if keys["req-a"] != "grantKeyA" {
		t.Fatalf("req-a pubkey = %q, want grantKeyA", keys["req-a"])
	}
	if keys["req-b"] != "" {
		t.Fatalf("req-b pubkey = %q, want empty (knocked contentless)", keys["req-b"])
	}

	// A wrong token, a missing token, and a never-existed alias all 403 (uniform).
	if rec := review("wrong-token"); rec.Code != http.StatusForbidden {
		t.Fatalf("wrong token: code %d, want 403", rec.Code)
	}
	if rec := review(""); rec.Code != http.StatusBadRequest {
		t.Fatalf("missing token: code %d, want 400", rec.Code)
	}
	miss := httptest.NewRequest("GET", contract.PathKnockPrefix+randID(t), nil)
	miss.Header.Set(contract.HeaderWriteToken, "owner-token")
	if rec := do(h, miss); rec.Code != http.StatusForbidden {
		t.Fatalf("nonexistent alias: code %d, want 403", rec.Code)
	}
}

// The whole existence-hiding contract: a real read and a miss are the same status,
// the same length, and a miss is stable across repeats.
func TestAliasReadIsExistenceUniform(t *testing.T) {
	h := newTestServer(t)
	real := randID(t)
	missing := randID(t)
	payload := bytes.Repeat([]byte{0x11}, contract.AliasPayloadSize)

	put := httptest.NewRequest("PUT", contract.PathAliasPrefix+real, bytes.NewReader(payload))
	put.Header.Set(contract.HeaderWriteToken, "tok")
	do(h, put)

	hit := do(h, httptest.NewRequest("GET", contract.PathAliasPrefix+real, nil))
	miss := do(h, httptest.NewRequest("GET", contract.PathAliasPrefix+missing, nil))

	if hit.Code != miss.Code || hit.Code != http.StatusOK {
		t.Fatalf("status differs: hit=%d miss=%d", hit.Code, miss.Code)
	}
	if hit.Body.Len() != miss.Body.Len() || hit.Body.Len() != contract.AliasPayloadSize {
		t.Fatalf("length differs: hit=%d miss=%d", hit.Body.Len(), miss.Body.Len())
	}
	// A repeated miss is byte-stable, exactly as a real stored payload would be.
	miss2 := do(h, httptest.NewRequest("GET", contract.PathAliasPrefix+missing, nil))
	if !bytes.Equal(miss.Body.Bytes(), miss2.Body.Bytes()) {
		t.Fatal("decoy not stable across repeats")
	}
	// Different missing ids get different decoys.
	other := do(h, httptest.NewRequest("GET", contract.PathAliasPrefix+randID(t), nil))
	if bytes.Equal(miss.Body.Bytes(), other.Body.Bytes()) {
		t.Fatal("decoys collide across ids")
	}
}

// Existence-timing uniformity (doc 02: existence uniformity is shape AND timing):
// a hit must compute the decoy too, so it pays the same HMAC cost as a miss. We
// count decoy computations on the read path via decoyComputeHook and assert a hit
// and a miss compute it the same number of times (1 each). A future refactor that
// returns the stored bytes BEFORE computing the decoy (e.g. an `if found { return }`
// placed first) drops the hit-path count to 0 and turns this red.
func TestAliasReadComputesDecoyOnHitAndMiss(t *testing.T) {
	h := newTestServer(t)
	real := randID(t)
	missing := randID(t)
	payload := bytes.Repeat([]byte{0x22}, contract.AliasPayloadSize)

	put := httptest.NewRequest("PUT", contract.PathAliasPrefix+real, bytes.NewReader(payload))
	put.Header.Set(contract.HeaderWriteToken, "tok")
	do(h, put)

	var computes int
	decoyComputeHook = func() { computes++ }
	t.Cleanup(func() { decoyComputeHook = nil })

	computes = 0
	hitBody := do(h, httptest.NewRequest("GET", contract.PathAliasPrefix+real, nil)).Body.Bytes()
	hitComputes := computes
	if !bytes.Equal(hitBody, payload) {
		t.Fatal("hit did not return the stored payload")
	}

	computes = 0
	do(h, httptest.NewRequest("GET", contract.PathAliasPrefix+missing, nil))
	missComputes := computes

	if hitComputes != missComputes {
		t.Fatalf("decoy computed %d times on a hit, %d on a miss; a hit must pay the same HMAC cost",
			hitComputes, missComputes)
	}
	if hitComputes != 1 {
		t.Fatalf("expected exactly one decoy compute per read, got %d", hitComputes)
	}
}

// The notify inbox is the same blind, fixed-size, write-token-gated, existence-
// uniform protocol as alias, on its own /inbox path and table.
func TestInboxRoundTripAndExistenceUniform(t *testing.T) {
	h := newTestServer(t)
	id := randID(t)
	payload := bytes.Repeat([]byte{0x5A}, contract.AliasPayloadSize)

	put := httptest.NewRequest("PUT", contract.PathInboxPrefix+id, bytes.NewReader(payload))
	put.Header.Set(contract.HeaderWriteToken, "inbox-token")
	if rec := do(h, put); rec.Code != http.StatusNoContent {
		t.Fatalf("inbox put: %d", rec.Code)
	}

	// A stored inbox reads back exactly.
	hit := do(h, httptest.NewRequest("GET", contract.PathInboxPrefix+id, nil))
	if hit.Code != http.StatusOK || !bytes.Equal(hit.Body.Bytes(), payload) {
		t.Fatalf("inbox get: code=%d match=%v", hit.Code, bytes.Equal(hit.Body.Bytes(), payload))
	}

	// A miss is a fixed-size decoy: same status + length, stable across repeats,
	// and indistinguishable from a real read.
	missing := randID(t)
	miss := do(h, httptest.NewRequest("GET", contract.PathInboxPrefix+missing, nil))
	if miss.Code != hit.Code || miss.Body.Len() != contract.AliasPayloadSize {
		t.Fatalf("inbox miss: code=%d len=%d", miss.Code, miss.Body.Len())
	}
	miss2 := do(h, httptest.NewRequest("GET", contract.PathInboxPrefix+missing, nil))
	if !bytes.Equal(miss.Body.Bytes(), miss2.Body.Bytes()) {
		t.Fatal("inbox decoy not stable across repeats")
	}

	// A wrong token cannot overwrite the inbox.
	evil := httptest.NewRequest("PUT", contract.PathInboxPrefix+id, bytes.NewReader(payload))
	evil.Header.Set(contract.HeaderWriteToken, "not-owner")
	if rec := do(h, evil); rec.Code != http.StatusForbidden {
		t.Fatalf("inbox wrong-token write: %d, want 403", rec.Code)
	}

	// Wrong size is rejected.
	short := httptest.NewRequest("PUT", contract.PathInboxPrefix+randID(t), strings.NewReader("too short"))
	short.Header.Set(contract.HeaderWriteToken, "tok")
	if rec := do(h, short); rec.Code != http.StatusBadRequest {
		t.Fatalf("inbox short payload: %d, want 400", rec.Code)
	}
}

// The alias and inbox namespaces are independent: writing an id as an alias does
// not make it readable as an inbox (it reads back as a decoy, not the ciphertext).
func TestInboxAndAliasNamespacesAreSeparate(t *testing.T) {
	h := newTestServer(t)
	id := randID(t)
	payload := bytes.Repeat([]byte{0x33}, contract.AliasPayloadSize)
	put := httptest.NewRequest("PUT", contract.PathAliasPrefix+id, bytes.NewReader(payload))
	put.Header.Set(contract.HeaderWriteToken, "tok")
	if rec := do(h, put); rec.Code != http.StatusNoContent {
		t.Fatalf("alias put: %d", rec.Code)
	}
	// The same id on /inbox is a miss -> a decoy, never the alias ciphertext.
	got := do(h, httptest.NewRequest("GET", contract.PathInboxPrefix+id, nil))
	if got.Code != http.StatusOK || got.Body.Len() != contract.AliasPayloadSize {
		t.Fatalf("inbox read of an alias id: code=%d len=%d", got.Code, got.Body.Len())
	}
	if bytes.Equal(got.Body.Bytes(), payload) {
		t.Fatal("inbox leaked the alias ciphertext for a shared id")
	}
}

// The catastrophic-overload fallback for a sensitive read MUST be byte-identical
// to a normal miss, or saturation becomes a distinguishable signal (an existence
// leak). This pins it for BOTH /a and /inbox, since uniformOverload's id-extraction
// (trim both prefixes) is exactly the kind of code a refactor could silently break.
func TestOverloadDecoyMatchesMiss(t *testing.T) {
	st, err := store.Open(context.Background(), filepath.Join(t.TempDir(), "t.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	secret := bytes.Repeat([]byte{0x42}, 32)
	srv := New(st, Config{DecoySecret: secret}, slog.New(slog.NewTextHandler(io.Discard, nil)), nil)
	h := srv.Handler()
	id := randID(t)

	for _, prefix := range []string{contract.PathAliasPrefix, contract.PathInboxPrefix} {
		canonical := decoyBytes(secret, id, contract.AliasPayloadSize)

		// A normal miss through the handler.
		miss := do(h, httptest.NewRequest("GET", prefix+id, nil))
		if !bytes.Equal(miss.Body.Bytes(), canonical) {
			t.Fatalf("%s normal miss != canonical decoy", prefix)
		}

		// The overload fallback for the same id+path.
		rec := httptest.NewRecorder()
		srv.uniformOverload(rec, httptest.NewRequest("GET", prefix+id, nil))
		if !bytes.Equal(rec.Body.Bytes(), canonical) {
			t.Fatalf("%s overload decoy != canonical (distinguishable from a miss)", prefix)
		}
	}
}

func TestAliasWriteTokenEnforced(t *testing.T) {
	h := newTestServer(t)
	id := randID(t)
	payload := bytes.Repeat([]byte{1}, contract.AliasPayloadSize)

	owner := httptest.NewRequest("PUT", contract.PathAliasPrefix+id, bytes.NewReader(payload))
	owner.Header.Set(contract.HeaderWriteToken, "owner")
	if rec := do(h, owner); rec.Code != http.StatusNoContent {
		t.Fatalf("owner write: %d", rec.Code)
	}
	evil := httptest.NewRequest("PUT", contract.PathAliasPrefix+id, bytes.NewReader(bytes.Repeat([]byte{2}, contract.AliasPayloadSize)))
	evil.Header.Set(contract.HeaderWriteToken, "not-owner")
	if rec := do(h, evil); rec.Code != http.StatusForbidden {
		t.Fatalf("non-owner write: %d, want 403", rec.Code)
	}
}

func TestAliasWriteRejectsWrongSize(t *testing.T) {
	h := newTestServer(t)
	req := httptest.NewRequest("PUT", contract.PathAliasPrefix+randID(t), strings.NewReader("too short"))
	req.Header.Set(contract.HeaderWriteToken, "tok")
	if rec := do(h, req); rec.Code != http.StatusBadRequest {
		t.Fatalf("short payload: %d, want 400", rec.Code)
	}
}

// accountPut issues PUT /acct/{id} with the given body and write token.
func accountPut(h http.Handler, id, token, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest("PUT", contract.PathAccountPrefix+id, strings.NewReader(body))
	if token != "" {
		req.Header.Set(contract.HeaderWriteToken, token)
	}
	return do(h, req)
}

// accountDelete issues DELETE /acct/{id} with the given write token.
func accountDelete(h http.Handler, id, token string) *httptest.ResponseRecorder {
	req := httptest.NewRequest("DELETE", contract.PathAccountPrefix+id, nil)
	if token != "" {
		req.Header.Set(contract.HeaderWriteToken, token)
	}
	return do(h, req)
}

func TestAccountSyncRoundTrip(t *testing.T) {
	h := newTestServer(t)
	id := randID(t)

	if rec := accountPut(h, id, "owner-wt", "blob-v1"); rec.Code != http.StatusNoContent || rec.Header().Get(contract.HeaderVersion) != "1" {
		t.Fatalf("put1: code=%d version=%q", rec.Code, rec.Header().Get(contract.HeaderVersion))
	}
	if rec := accountPut(h, id, "owner-wt", "blob-v2"); rec.Header().Get(contract.HeaderVersion) != "2" {
		t.Fatalf("put2 version=%q, want 2", rec.Header().Get(contract.HeaderVersion))
	}
	get := do(h, httptest.NewRequest("GET", contract.PathAccountPrefix+id, nil))
	if get.Code != http.StatusOK || get.Body.String() != "blob-v2" || get.Header().Get(contract.HeaderVersion) != "2" {
		t.Fatalf("get: code=%d body=%q version=%q", get.Code, get.Body.String(), get.Header().Get(contract.HeaderVersion))
	}
}

// A PUT may carry an X-Version precondition for optimistic concurrency (doc 22 S8):
// naming the current version overwrites and bumps it; naming a stale one is a 409
// that leaves the blob untouched and reports the current version back; a malformed
// version is a 400; and no header stays unconditional (last-write-wins, as before).
func TestAccountVersionPrecondition(t *testing.T) {
	h := newTestServer(t)
	id := randID(t)

	put := func(body, ifVersion string) *httptest.ResponseRecorder {
		req := httptest.NewRequest("PUT", contract.PathAccountPrefix+id, strings.NewReader(body))
		req.Header.Set(contract.HeaderWriteToken, "owner-wt")
		if ifVersion != "" {
			req.Header.Set(contract.HeaderVersion, ifVersion)
		}
		return do(h, req)
	}

	if rec := put("v1", ""); rec.Code != http.StatusNoContent {
		t.Fatalf("create: %d, want 204", rec.Code)
	}
	// Naming the current version (1) succeeds and bumps to 2.
	if rec := put("v2", "1"); rec.Code != http.StatusNoContent || rec.Header().Get(contract.HeaderVersion) != "2" {
		t.Fatalf("matched precondition: code=%d version=%q, want 204/2", rec.Code, rec.Header().Get(contract.HeaderVersion))
	}
	// Naming the now-stale version (1) is a 409; the current version comes back so
	// the client can reload, merge, and retry against it.
	stale := put("v3", "1")
	if stale.Code != http.StatusConflict || stale.Header().Get(contract.HeaderVersion) != "2" {
		t.Fatalf("stale precondition: code=%d version=%q, want 409/2", stale.Code, stale.Header().Get(contract.HeaderVersion))
	}
	if get := do(h, httptest.NewRequest("GET", contract.PathAccountPrefix+id, nil)); get.Body.String() != "v2" {
		t.Fatalf("after 409: body=%q, want v2 unchanged", get.Body.String())
	}
	// A malformed version is a 400, never a silent unconditional write.
	if rec := put("v4", "not-a-number"); rec.Code != http.StatusBadRequest {
		t.Fatalf("malformed version: %d, want 400", rec.Code)
	}
	// No header stays unconditional: it overwrites regardless of the current version.
	if rec := put("v5", ""); rec.Code != http.StatusNoContent || rec.Header().Get(contract.HeaderVersion) != "3" {
		t.Fatalf("unconditional overwrite: code=%d version=%q, want 204/3", rec.Code, rec.Header().Get(contract.HeaderVersion))
	}
}

// The account write token gates overwrite and delete (symmetric with aliases):
// knowing the id (which travels on the wire) is not enough. A PUT or DELETE with no
// token is a 400; with a wrong token a 403 that changes nothing; GET stays open
// since the blob is encrypted anyway.
func TestAccountWriteTokenGate(t *testing.T) {
	h := newTestServer(t)
	id := randID(t)

	if rec := accountPut(h, id, "", "blob"); rec.Code != http.StatusBadRequest {
		t.Fatalf("put without token: %d, want 400", rec.Code)
	}
	if rec := accountPut(h, id, "owner-wt", "blob-v1"); rec.Code != http.StatusNoContent {
		t.Fatalf("owner first put: %d", rec.Code)
	}
	// A second writer who only knows the id cannot overwrite or delete it.
	if rec := accountPut(h, id, "thief-wt", "evil"); rec.Code != http.StatusForbidden {
		t.Fatalf("foreign put: %d, want 403", rec.Code)
	}
	if rec := accountDelete(h, id, "thief-wt"); rec.Code != http.StatusForbidden {
		t.Fatalf("foreign delete: %d, want 403", rec.Code)
	}
	// The blob is intact and still readable by anyone with the id (encrypted at rest).
	if get := do(h, httptest.NewRequest("GET", contract.PathAccountPrefix+id, nil)); get.Code != http.StatusOK || get.Body.String() != "blob-v1" {
		t.Fatalf("get after foreign writes: code=%d body=%q, want 200/blob-v1", get.Code, get.Body.String())
	}
	if rec := accountDelete(h, id, ""); rec.Code != http.StatusBadRequest {
		t.Fatalf("delete without token: %d, want 400", rec.Code)
	}
}

func TestAccountDelete(t *testing.T) {
	h := newTestServer(t)
	id := randID(t)

	if rec := accountPut(h, id, "owner-wt", "blob"); rec.Code != http.StatusNoContent {
		t.Fatalf("put: code=%d", rec.Code)
	}

	if del := accountDelete(h, id, "owner-wt"); del.Code != http.StatusNoContent {
		t.Fatalf("delete: code=%d", del.Code)
	}
	// The blob is gone: GET now 404s like a never-existed account.
	if get := do(h, httptest.NewRequest("GET", contract.PathAccountPrefix+id, nil)); get.Code != http.StatusNotFound {
		t.Fatalf("get after delete: code=%d, want 404", get.Code)
	}
	// Idempotent: deleting again (or a never-existed id) still 204s, revealing nothing.
	if again := accountDelete(h, id, "owner-wt"); again.Code != http.StatusNoContent {
		t.Fatalf("delete again: code=%d", again.Code)
	}
	if miss := accountDelete(h, randID(t), "any-wt"); miss.Code != http.StatusNoContent {
		t.Fatalf("delete missing: code=%d", miss.Code)
	}
	// A malformed id is rejected.
	if bad := accountDelete(h, "short", "owner-wt"); bad.Code != http.StatusBadRequest {
		t.Fatalf("delete malformed: code=%d, want 400", bad.Code)
	}
}

// Knock is byte-identical for a real id, a different id, and a malformed id, and
// carrying an ephemeral grant key changes nothing the requester can observe.
func TestKnockIsUniform(t *testing.T) {
	h := newTestServer(t)
	want := `{"status":"received"}` + "\n"

	bodies := []contract.KnockRequest{
		{RequesterHash: "req"},
		{RequesterHash: "req", PubKey: "anEphemeralGrantKey"},
	}
	for _, target := range []string{randID(t), randID(t), "not-a-valid-id"} {
		for _, kr := range bodies {
			body, _ := json.Marshal(kr)
			rec := do(h, httptest.NewRequest("POST", contract.PathKnockPrefix+target, bytes.NewReader(body)))
			if rec.Code != http.StatusOK {
				t.Fatalf("knock %q: code %d", target, rec.Code)
			}
			if rec.Body.String() != want {
				t.Fatalf("knock %q: body %q, want %q", target, rec.Body.String(), want)
			}
		}
	}
}

// The global knock cap bounds total knock writes across ALL callers, so a
// distributed flood using many fresh requester hashes (which each get their own
// per-key bucket and so never trip the per-(id,requester) cap) still can't bloat the
// table. Crucially the cap is SILENT: every knock is a uniform 202, but once the
// global bucket is drained the rows simply stop being recorded, so existence stays
// hidden. Frozen clock = no refill.
func TestKnockGlobalCapSilentlyDropsWrites(t *testing.T) {
	st, err := store.Open(context.Background(), filepath.Join(t.TempDir(), "t.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	srv := New(st, Config{
		DecoySecret:       make([]byte, 32),
		KnockRatePerID:    1000, // generous per-key, so distinct requesters never trip it
		KnockBurst:        1000,
		KnockGlobalPerSec: 0.000001,
		KnockGlobalBurst:  2,
	}, slog.New(slog.NewTextHandler(io.Discard, nil)), func() int64 { return 1000 })
	h := srv.Handler()

	id := randID(t)
	for i := 0; i < 5; i++ {
		// A DIFFERENT requester each time, so the per-key cap always allows; only the
		// shared global bucket can stop the write.
		body, _ := json.Marshal(contract.KnockRequest{RequesterHash: fmt.Sprintf("req-%d", i)})
		rec := do(h, httptest.NewRequest("POST", contract.PathKnockPrefix+id, bytes.NewReader(body)))
		if rec.Code != http.StatusOK {
			t.Fatalf("knock %d: code %d, want 200 (uniform even when shed)", i, rec.Code)
		}
	}
	// Only the first two (the global burst) were recorded; the rest were silently dropped.
	if n, err := st.RecentKnockCount(context.Background(), id, 0); err != nil || n != 2 {
		t.Fatalf("recorded knocks = %d (err %v), want 2 (global burst)", n, err)
	}
}

// The limiter must key on the Caddy-set X-Real-IP, and only that: a fresh IP gets
// a fresh bucket, the same IP gets throttled, and client-spoofable headers are
// ignored.
func TestRateLimitBindsToXRealIP(t *testing.T) {
	st, err := store.Open(context.Background(), filepath.Join(t.TempDir(), "t.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	secret := make([]byte, 32)
	clock := func() int64 { return 1000 } // frozen, so buckets never refill mid-test
	srv := New(st, Config{DecoySecret: secret, IPBurst: 1, IPRatePerSec: 0.000001},
		slog.New(slog.NewTextHandler(io.Discard, nil)), clock)
	h := srv.Handler()

	notify := func(realIP, spoofXFF string) int {
		req := httptest.NewRequest("POST", contract.PathNotify, strings.NewReader(`{"tokenHash":"x"}`))
		req.Header.Set("Content-Type", "application/json")
		if realIP != "" {
			req.Header.Set("X-Real-IP", realIP)
		}
		if spoofXFF != "" {
			req.Header.Set("X-Forwarded-For", spoofXFF)
		}
		return do(h, req).Code
	}

	if code := notify("1.1.1.1", ""); code != http.StatusAccepted {
		t.Fatalf("first request: %d, want 202", code)
	}
	if code := notify("1.1.1.1", ""); code != http.StatusTooManyRequests {
		t.Fatalf("second from same IP: %d, want 429", code)
	}
	// A spoofed X-Forwarded-For must NOT mint a fresh bucket (still the same X-Real-IP).
	if code := notify("1.1.1.1", "9.9.9.9"); code != http.StatusTooManyRequests {
		t.Fatalf("spoofed XFF bypassed the limit: %d, want 429", code)
	}
	// A genuinely different client (different X-Real-IP) gets its own bucket.
	if code := notify("2.2.2.2", ""); code != http.StatusAccepted {
		t.Fatalf("different IP: %d, want 202", code)
	}
}

func TestSensitivePathIsMethodAware(t *testing.T) {
	cases := []struct {
		m, p string
		want bool
	}{
		{"GET", contract.PathAliasPrefix + "x", true},
		{"POST", contract.PathKnockPrefix + "x", true},
		{"PUT", contract.PathAliasPrefix + "x", false}, // a write, sheddable
		{"GET", contract.PathAccountPrefix + "x", false},
	}
	for _, c := range cases {
		if got := sensitivePath(c.m, c.p); got != c.want {
			t.Fatalf("sensitivePath(%q, %q) = %v, want %v", c.m, c.p, got, c.want)
		}
	}
}

// Under saturation the sensitive-path fallback must be byte-identical to a normal
// miss: a 4096-byte alias decoy, or the fixed knock reply.
func TestUniformOverloadIsExistenceBlind(t *testing.T) {
	st, err := store.Open(context.Background(), filepath.Join(t.TempDir(), "t.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	srv := New(st, Config{DecoySecret: make([]byte, 32)}, slog.New(slog.NewTextHandler(io.Discard, nil)), nil)

	rec := httptest.NewRecorder()
	srv.uniformOverload(rec, httptest.NewRequest("GET", contract.PathAliasPrefix+randID(t), nil))
	if rec.Code != http.StatusOK || rec.Body.Len() != contract.AliasPayloadSize {
		t.Fatalf("alias overload: code=%d len=%d", rec.Code, rec.Body.Len())
	}
	rec2 := httptest.NewRecorder()
	srv.uniformOverload(rec2, httptest.NewRequest("POST", contract.PathKnockPrefix+randID(t), nil))
	if rec2.Body.String() != `{"status":"received"}`+"\n" {
		t.Fatalf("knock overload body = %q", rec2.Body.String())
	}
}

func TestHealth(t *testing.T) {
	h := newTestServer(t)
	rec := do(h, httptest.NewRequest("GET", contract.PathHealth, nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("health: %d", rec.Code)
	}
}

func TestRootLanding(t *testing.T) {
	h := newTestServer(t)
	rec := do(h, httptest.NewRequest("GET", "/", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("root: %d", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "text/html") {
		t.Fatalf("root content-type = %q", ct)
	}
	if !strings.Contains(rec.Body.String(), "sti.care") {
		t.Fatal("landing missing brand")
	}
	// The {$} anchor matters: an unknown path is not the landing.
	if r := do(h, httptest.NewRequest("GET", "/nope", nil)); r.Code == http.StatusOK {
		t.Fatalf("unknown path returned 200")
	}
}

// TestConcurrentPutsPersistViaHTTP drives the real HTTP handler with a bounded
// pool of 32 concurrent writers (below MaxInflight so nothing is shed), each
// PUT a unique id + unique client IP, then reads every id back. A 204 that does
// not persist is data loss.
func TestConcurrentPutsPersistViaHTTP(t *testing.T) {
	h := newTestServer(t)
	const workers, perWorker = 32, 50
	const n = workers * perWorker
	ids := make([]string, n)
	codes := make([]int, n)
	var wg sync.WaitGroup
	for w := 0; w < workers; w++ {
		wg.Add(1)
		go func(w int) {
			defer wg.Done()
			for j := 0; j < perWorker; j++ {
				i := w*perWorker + j
				ids[i] = randID(t)
				body := bytes.Repeat([]byte{byte(i)}, contract.AliasPayloadSize)
				put := httptest.NewRequest("PUT", contract.PathAliasPrefix+ids[i], bytes.NewReader(body))
				put.Header.Set(contract.HeaderWriteToken, "tok")
				put.Header.Set("X-Real-IP", fmt.Sprintf("10.1.%d.%d", i/256, i%256))
				codes[i] = do(h, put).Code
			}
		}(w)
	}
	wg.Wait()

	lost, notCreated := 0, 0
	for i := 0; i < n; i++ {
		if codes[i] != http.StatusNoContent {
			notCreated++
			continue
		}
		want := bytes.Repeat([]byte{byte(i)}, contract.AliasPayloadSize)
		rec := do(h, httptest.NewRequest("GET", contract.PathAliasPrefix+ids[i], nil))
		if !bytes.Equal(rec.Body.Bytes(), want) {
			lost++
		}
	}
	if notCreated > 0 {
		t.Fatalf("%d/%d PUTs were not 204 (unexpected shedding/errors)", notCreated, n)
	}
	if lost > 0 {
		t.Fatalf("%d/%d PUTs returned 204 but did not persist (data loss)", lost, n)
	}
}

func TestVanityResolve(t *testing.T) {
	st, err := store.Open(context.Background(), filepath.Join(t.TempDir(), "t.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	secret := make([]byte, 32)
	for i := range secret {
		secret[i] = byte(i + 1)
	}
	srv := New(st, Config{DecoySecret: secret}, slog.New(slog.NewTextHandler(io.Discard, nil)), nil)
	h := srv.Handler()

	aliasID := randID(t)
	if _, err := st.ClaimVanityName(context.Background(), "robin", aliasID, 1); err != nil {
		t.Fatal(err)
	}

	// A registered name resolves to its opaque alias id (and only that).
	rec := do(h, httptest.NewRequest("GET", "/u/robin", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("registered name: want 200, got %d", rec.Code)
	}
	var resp contract.VanityResolveResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp.AliasID != aliasID {
		t.Fatalf("aliasId: got %q, want %q", resp.AliasID, aliasID)
	}

	// The path is normalized (lowercased) before lookup, so an uppercase request
	// resolves the same name.
	if rec := do(h, httptest.NewRequest("GET", "/u/ROBIN", nil)); rec.Code != http.StatusOK {
		t.Fatalf("uppercase name: want 200, got %d", rec.Code)
	}

	// An unregistered name is a bare 404: no body, no hint.
	rec404 := do(h, httptest.NewRequest("GET", "/u/nobody", nil))
	if rec404.Code != http.StatusNotFound {
		t.Fatalf("unknown name: want 404, got %d", rec404.Code)
	}
	if rec404.Body.Len() != 0 {
		t.Fatalf("unknown name: want empty body, got %q", rec404.Body.String())
	}
}

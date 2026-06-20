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

func TestAccountSyncRoundTrip(t *testing.T) {
	h := newTestServer(t)
	id := randID(t)

	put := httptest.NewRequest("PUT", contract.PathAccountPrefix+id, strings.NewReader("blob-v1"))
	rec := do(h, put)
	if rec.Code != http.StatusNoContent || rec.Header().Get(contract.HeaderVersion) != "1" {
		t.Fatalf("put1: code=%d version=%q", rec.Code, rec.Header().Get(contract.HeaderVersion))
	}
	put2 := httptest.NewRequest("PUT", contract.PathAccountPrefix+id, strings.NewReader("blob-v2"))
	if rec := do(h, put2); rec.Header().Get(contract.HeaderVersion) != "2" {
		t.Fatalf("put2 version=%q, want 2", rec.Header().Get(contract.HeaderVersion))
	}
	get := do(h, httptest.NewRequest("GET", contract.PathAccountPrefix+id, nil))
	if get.Code != http.StatusOK || get.Body.String() != "blob-v2" || get.Header().Get(contract.HeaderVersion) != "2" {
		t.Fatalf("get: code=%d body=%q version=%q", get.Code, get.Body.String(), get.Header().Get(contract.HeaderVersion))
	}
}

func TestAccountDelete(t *testing.T) {
	h := newTestServer(t)
	id := randID(t)

	put := httptest.NewRequest("PUT", contract.PathAccountPrefix+id, strings.NewReader("blob"))
	if rec := do(h, put); rec.Code != http.StatusNoContent {
		t.Fatalf("put: code=%d", rec.Code)
	}

	del := do(h, httptest.NewRequest("DELETE", contract.PathAccountPrefix+id, nil))
	if del.Code != http.StatusNoContent {
		t.Fatalf("delete: code=%d", del.Code)
	}
	// The blob is gone: GET now 404s like a never-existed account.
	if get := do(h, httptest.NewRequest("GET", contract.PathAccountPrefix+id, nil)); get.Code != http.StatusNotFound {
		t.Fatalf("get after delete: code=%d, want 404", get.Code)
	}
	// Idempotent: deleting again (or a never-existed id) still 204s, revealing nothing.
	if again := do(h, httptest.NewRequest("DELETE", contract.PathAccountPrefix+id, nil)); again.Code != http.StatusNoContent {
		t.Fatalf("delete again: code=%d", again.Code)
	}
	if miss := do(h, httptest.NewRequest("DELETE", contract.PathAccountPrefix+randID(t), nil)); miss.Code != http.StatusNoContent {
		t.Fatalf("delete missing: code=%d", miss.Code)
	}
	// A malformed id is rejected.
	if bad := do(h, httptest.NewRequest("DELETE", contract.PathAccountPrefix+"short", nil)); bad.Code != http.StatusBadRequest {
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

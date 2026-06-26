package server

import (
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"sti.care/api/internal/contract"
	"sti.care/api/internal/store"
)

// newRepublishServer builds a server with a fixed clock and the given decorrelation
// window, plus its store so a test can seed aliases and inspect the queue.
func newRepublishServer(t *testing.T, window time.Duration, now int64) (*Server, *store.Store) {
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
	srv := New(st, Config{DecoySecret: secret, RepublishWindow: window},
		slog.New(slog.NewTextHandler(io.Discard, nil)), func() int64 { return now })
	return srv, st
}

// payload returns a distinct, fixed-size alias payload (the byte b repeated).
func payload(b byte) []byte {
	p := make([]byte, contract.AliasPayloadSize)
	for i := range p {
		p[i] = b
	}
	return p
}

func republishBody(ops []contract.RepublishOp) *http.Request {
	body, _ := json.Marshal(contract.RepublishRequest{Ops: ops})
	return httptest.NewRequest("POST", contract.PathRepublish, strings.NewReader(string(body)))
}

func op(id, token string, ct []byte) contract.RepublishOp {
	return contract.RepublishOp{
		ID:         id,
		Ciphertext: base64.RawURLEncoding.EncodeToString(ct),
		WriteToken: token,
	}
}

func republishDepth(t *testing.T, st *store.Store) int {
	t.Helper()
	due, err := st.DueRepublishes(context.Background(), farFuture, 4096)
	if err != nil {
		t.Fatal(err)
	}
	return len(due)
}

// A batch is accepted (202) and enqueues one deferred overwrite per op.
func TestRepublishEnqueuesBatch(t *testing.T) {
	srv, st := newRepublishServer(t, 0, 1000)
	h := srv.Handler()
	ops := []contract.RepublishOp{
		op(randID(t), "wt-1", payload(1)),
		op(randID(t), "wt-2", payload(2)),
	}
	if rec := do(h, republishBody(ops)); rec.Code != http.StatusAccepted {
		t.Fatalf("republish: %d, want 202", rec.Code)
	}
	if d := republishDepth(t, st); d != 2 {
		t.Fatalf("queue depth = %d, want 2", d)
	}
}

// A malformed batch is rejected whole (400) and enqueues NOTHING: no partial apply.
func TestRepublishRejectsMalformedBatchWhole(t *testing.T) {
	srv, st := newRepublishServer(t, 0, 1000)
	h := srv.Handler()
	good := op(randID(t), "wt", payload(1))

	cases := map[string][]contract.RepublishOp{
		"empty":       {},
		"bad id":      {good, op("short", "wt", payload(2))},
		"empty token": {good, op(randID(t), "", payload(2))},
		"wrong size":  {good, op(randID(t), "wt", make([]byte, 10))},
		"not base64":  {good, {ID: randID(t), Ciphertext: "!!!!", WriteToken: "wt"}},
	}
	for name, ops := range cases {
		rec := do(h, republishBody(ops))
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("%s: %d, want 400", name, rec.Code)
		}
	}
	if d := republishDepth(t, st); d != 0 {
		t.Fatalf("a rejected batch enqueued %d ops, want 0 (all-or-nothing)", d)
	}
}

// An over-size batch is a 400, never a silent truncation.
func TestRepublishRejectsOversizeBatch(t *testing.T) {
	srv, _ := newRepublishServer(t, 0, 1000)
	h := srv.Handler()
	ops := make([]contract.RepublishOp, contract.RepublishMaxOps+1)
	for i := range ops {
		ops[i] = op(randID(t), "wt", payload(1))
	}
	if rec := do(h, republishBody(ops)); rec.Code != http.StatusBadRequest {
		t.Fatalf("oversize batch: %d, want 400", rec.Code)
	}
}

// The drain applies a deferred overwrite via the alias write path, gated by the
// write token, then removes it from the queue.
func TestRepublishDrainApplies(t *testing.T) {
	ctx := context.Background()
	srv, st := newRepublishServer(t, 0, 1000)
	h := srv.Handler()
	id := randID(t)
	// Bind the alias's write token with an initial write, then republish it.
	if _, err := st.WriteAlias(ctx, id, payload(9), hashToken("owner-wt"), 1, sql.NullInt64{}, false); err != nil {
		t.Fatal(err)
	}
	if rec := do(h, republishBody([]contract.RepublishOp{op(id, "owner-wt", payload(7))})); rec.Code != http.StatusAccepted {
		t.Fatalf("republish: %d", rec.Code)
	}

	srv.DrainRepublishes(ctx, 1000)

	ct, _, found, err := st.GetAlias(ctx, id)
	if err != nil || !found {
		t.Fatalf("alias gone after republish: found=%v err=%v", found, err)
	}
	if ct[0] != 7 {
		t.Fatalf("alias not overwritten: first byte %d, want 7", ct[0])
	}
	if d := republishDepth(t, st); d != 0 {
		t.Fatalf("applied op not removed: %d remain", d)
	}
}

// A deferred overwrite whose write token does NOT match the alias is dropped, not
// retried forever, and leaves the alias untouched.
func TestRepublishDrainDropsForeignToken(t *testing.T) {
	ctx := context.Background()
	srv, st := newRepublishServer(t, 0, 1000)
	h := srv.Handler()
	id := randID(t)
	if _, err := st.WriteAlias(ctx, id, payload(9), hashToken("owner-wt"), 1, sql.NullInt64{}, false); err != nil {
		t.Fatal(err)
	}
	// A batch with the WRONG token for an existing alias.
	if rec := do(h, republishBody([]contract.RepublishOp{op(id, "thief-wt", payload(7))})); rec.Code != http.StatusAccepted {
		t.Fatalf("republish: %d", rec.Code)
	}

	srv.DrainRepublishes(ctx, 1000)

	ct, _, _, _ := st.GetAlias(ctx, id)
	if ct[0] != 9 {
		t.Fatalf("foreign-token republish changed the alias: first byte %d, want 9", ct[0])
	}
	if d := republishDepth(t, st); d != 0 {
		t.Fatalf("undeliverable op not dropped: %d remain", d)
	}
}

// Decorrelation: with a window, a batch's overwrites are spread across it, NOT all
// applied at submission time. Draining at submission leaves most still queued;
// draining past the window applies them all.
func TestRepublishSpreadsAcrossWindow(t *testing.T) {
	ctx := context.Background()
	const window = 100_000
	srv, st := newRepublishServer(t, window*time.Millisecond, 1000)
	h := srv.Handler()
	// 60 ops so each window quarter expects ~15: an empty quarter then means the
	// times genuinely failed to scatter, not bad luck (P(empty quarter) < 1e-6).
	ops := make([]contract.RepublishOp, 60)
	for i := range ops {
		ops[i] = op(randID(t), fmt.Sprintf("wt-%d", i), payload(byte(i)))
	}
	if rec := do(h, republishBody(ops)); rec.Code != http.StatusAccepted {
		t.Fatalf("republish: %d", rec.Code)
	}

	// At submission time only the ops jittered to ~0 are due, so most remain queued:
	// the batch is spread, not a same-instant burst.
	srv.DrainRepublishes(ctx, 1000)
	if d := republishDepth(t, st); d < len(ops)/2 {
		t.Fatalf("batch was not spread: only %d of %d remain after draining at submission", d, len(ops))
	}

	// Drain quarter by quarter across the window: each quarter must bring at least
	// one fresh op due. Independently jittered times scatter across the WHOLE
	// window, so a degenerate "half now, half at the end" schedule (which the old
	// >= len/2 check accepted) would leave the middle quarters empty and fail here.
	prev := republishDepth(t, st)
	for q := 1; q <= 3; q++ {
		srv.DrainRepublishes(ctx, 1000+int64(q)*window/4)
		remaining := republishDepth(t, st)
		if prev-remaining <= 0 {
			t.Fatalf("quarter %d brought no op due: times are not scattered across the window", q)
		}
		prev = remaining
	}

	// Past the window every op is due and applied; the queue drains empty.
	srv.DrainRepublishes(ctx, 1000+window+1)
	if d := republishDepth(t, st); d != 0 {
		t.Fatalf("queue not drained past the window: %d remain", d)
	}
}

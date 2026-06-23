package server

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"sti.care/api/internal/contract"
	"sti.care/api/internal/store"
)

const farFuture = int64(1) << 62

// mockSender records every wake it is asked to deliver and can be made to fail.
type mockSender struct {
	mu   sync.Mutex
	sent []store.PushTarget
	err  error
}

func (m *mockSender) Send(_ context.Context, t store.PushTarget) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.sent = append(m.sent, t)
	return m.err
}

func (m *mockSender) count() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.sent)
}

func (m *mockSender) setErr(err error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.err = err
}

func newDrainServer(t *testing.T, enabled bool, sender Sender, coverWindow time.Duration) *Server {
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
	return New(st, Config{DecoySecret: secret, NotifyEnabled: enabled, Sender: sender, CoverWindow: coverWindow},
		slog.New(slog.NewTextHandler(io.Discard, nil)), nil)
}

func ok(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatal(err)
	}
}

func sendDepth(t *testing.T, s *Server) int {
	t.Helper()
	due, err := s.st.DueSends(context.Background(), farFuture, 1024)
	ok(t, err)
	return len(due)
}

func coverDepth(t *testing.T, s *Server) int {
	t.Helper()
	due, err := s.st.DueCovers(context.Background(), farFuture, 1024)
	ok(t, err)
	return len(due)
}

func registerRoute(t *testing.T, s *Server, route string) {
	t.Helper()
	ok(t, s.st.RegisterPush(context.Background(), route,
		store.PushTarget{Endpoint: "https://push/" + route, P256dh: "k", Auth: "a"}, 1))
}

// With CoverWindow 0 a real wake fans out and delivers to the whole push
// population in a single pass: the recipient is woken only as one anonymous member
// of the broadcast, and the real job is consumed.
func TestCoverWakeBroadcastsToWholePopulation(t *testing.T) {
	ctx := context.Background()
	ms := &mockSender{}
	s := newDrainServer(t, true, ms, 0)
	for _, r := range []string{"route-1", "route-2", "route-3"} {
		registerRoute(t, s, r)
	}
	// A real wake aimed at only ONE recipient.
	ok(t, s.st.EnqueueSend(ctx, "route-1", 100, 100))

	s.DrainSends(ctx, 200)

	if ms.count() != 3 {
		t.Fatalf("cover broadcast should wake all 3 routes, got %d", ms.count())
	}
	if d := sendDepth(t, s); d != 0 {
		t.Fatalf("real job not consumed: %d remain", d)
	}
	if d := coverDepth(t, s); d != 0 {
		t.Fatalf("covers not cleared: %d remain", d)
	}
}

// The real recipient is woken exactly once (via the broadcast), never also
// directly: the real job is dropped, not delivered.
func TestCoverWakeDoesNotDoubleWakeRecipient(t *testing.T) {
	ctx := context.Background()
	ms := &mockSender{}
	s := newDrainServer(t, true, ms, 0)
	registerRoute(t, s, "route-1")
	ok(t, s.st.EnqueueSend(ctx, "route-1", 100, 100))

	s.DrainSends(ctx, 200)

	if ms.count() != 1 {
		t.Fatalf("recipient should be woken once, got %d", ms.count())
	}
	if d := sendDepth(t, s) + coverDepth(t, s); d != 0 {
		t.Fatalf("queues not drained: %d remain", d)
	}
}

// Several real wakes coming due in one pass collapse to a SINGLE broadcast, not
// one per recipient: the anti-amplification property at the drain layer. Two real
// wakes among three routes wake the three routes once each (3 deliveries), not six.
func TestCoverWakeManyRealJobsCollapseToOneBroadcast(t *testing.T) {
	ctx := context.Background()
	ms := &mockSender{}
	s := newDrainServer(t, true, ms, 0)
	for _, r := range []string{"route-1", "route-2", "route-3"} {
		registerRoute(t, s, r)
	}
	ok(t, s.st.EnqueueSend(ctx, "route-1", 100, 100))
	ok(t, s.st.EnqueueSend(ctx, "route-2", 100, 100))

	s.DrainSends(ctx, 200)

	if ms.count() != 3 {
		t.Fatalf("two real wakes must fan out one broadcast (3), not per-job (6): got %d", ms.count())
	}
	if d := sendDepth(t, s) + coverDepth(t, s); d != 0 {
		t.Fatalf("queues not drained: %d remain", d)
	}
}

// A push population larger than one drain batch is still woken in full: the
// per-pass delivery ceiling spreads the broadcast across passes but loses no one.
func TestCoverWakePopulationLargerThanBatchEventuallyAllWoken(t *testing.T) {
	ctx := context.Background()
	ms := &mockSender{}
	s := newDrainServer(t, true, ms, 0)
	const population = drainBatch + 44 // one full batch plus a remainder
	seen := map[string]bool{}
	for i := 0; i < population; i++ {
		route := "route-" + strconv.Itoa(i)
		registerRoute(t, s, route)
		seen[route] = true
	}
	// A single real wake fans out to the whole population.
	ok(t, s.st.EnqueueSend(ctx, "route-0", 100, 100))

	// Pass 0 fans out the whole population and delivers the first batch; later
	// passes deliver the remainder. A handful of passes is ample for one batch
	// plus a remainder, and is deterministic since window 0 makes every cover due.
	for pass := 0; pass < 5; pass++ {
		s.DrainSends(ctx, 200)
	}

	if ms.count() != population {
		t.Fatalf("every route in the population must be woken: want %d, got %d", population, ms.count())
	}
	if d := sendDepth(t, s) + coverDepth(t, s); d != 0 {
		t.Fatalf("queues not fully drained: %d remain", d)
	}
}

func TestCoverWakeGatedOffIsInert(t *testing.T) {
	ctx := context.Background()
	ms := &mockSender{}
	s := newDrainServer(t, false, ms, 0) // gate OFF
	registerRoute(t, s, "route-1")
	ok(t, s.st.EnqueueSend(ctx, "route-1", 100, 100))

	s.DrainSends(ctx, 200)

	if ms.count() != 0 {
		t.Fatalf("delivered while gated off: %d", ms.count())
	}
	if d := sendDepth(t, s); d != 1 {
		t.Fatalf("send queue should be untouched while off, depth %d", d)
	}
	if d := coverDepth(t, s); d != 0 {
		t.Fatalf("no covers should be fanned out while off, depth %d", d)
	}
}

// A non-zero window defers the broadcast: pass 1 consumes the real job and
// schedules covers across the window; a pass at the window's end delivers all of
// them. Asserting on eventual completeness keeps the test free of jitter flakiness.
func TestCoverWakeDefersAcrossWindowThenDelivers(t *testing.T) {
	ctx := context.Background()
	ms := &mockSender{}
	const window = 2 * time.Minute
	s := newDrainServer(t, true, ms, window)
	registerRoute(t, s, "route-1")
	registerRoute(t, s, "route-2")
	ok(t, s.st.EnqueueSend(ctx, "route-1", 100, 100))

	// Pass 1 at t=200: the real job is consumed and the population is scheduled.
	s.DrainSends(ctx, 200)
	if d := sendDepth(t, s); d != 0 {
		t.Fatalf("real job should be consumed once scheduled, depth %d", d)
	}

	// Pass 2 at the window's end: every scheduled cover is now due and delivered.
	s.DrainSends(ctx, 200+window.Milliseconds())
	if ms.count() != 2 {
		t.Fatalf("whole population should eventually wake, got %d", ms.count())
	}
	if d := coverDepth(t, s); d != 0 {
		t.Fatalf("all covers should be delivered, depth %d", d)
	}
}

// A cover whose delivery fails is retained and retried on a later pass; nothing is
// lost on a transient push outage.
func TestCoverWakeRetainsCoverOnDeliveryFailure(t *testing.T) {
	ctx := context.Background()
	ms := &mockSender{err: errors.New("push gateway down")}
	s := newDrainServer(t, true, ms, 0)
	registerRoute(t, s, "route-1")
	ok(t, s.st.EnqueueSend(ctx, "route-1", 100, 100))

	s.DrainSends(ctx, 200)
	if ms.count() != 1 {
		t.Fatalf("want 1 delivery attempt, got %d", ms.count())
	}
	if d := coverDepth(t, s); d != 1 {
		t.Fatalf("failed cover must be retained for retry, depth %d", d)
	}
	if d := sendDepth(t, s); d != 0 {
		t.Fatalf("real job is already consumed, depth %d", d)
	}

	// The gateway recovers; the retained cover delivers and clears.
	ms.setErr(nil)
	s.DrainSends(ctx, 300)
	if d := coverDepth(t, s); d != 0 {
		t.Fatalf("recovered cover should clear, depth %d", d)
	}
}

// A real wake with no push population is a clean drop: nobody to wake, no covers,
// no leftover job.
func TestCoverWakeNoPopulationDropsRealSend(t *testing.T) {
	ctx := context.Background()
	ms := &mockSender{}
	s := newDrainServer(t, true, ms, 0)
	ok(t, s.st.EnqueueSend(ctx, "orphan-route", 100, 100))

	s.DrainSends(ctx, 200)

	if ms.count() != 0 {
		t.Fatalf("nothing to deliver, got %d", ms.count())
	}
	if d := sendDepth(t, s) + coverDepth(t, s); d != 0 {
		t.Fatalf("a wake with no population should drop cleanly: %d remain", d)
	}
}

func notifyReq(tokenHash string) *http.Request {
	return httptest.NewRequest("POST", contract.PathNotify,
		strings.NewReader(`{"tokenHash":"`+tokenHash+`"}`))
}

// Registering a push subscription must also make the device reachable: a notify
// for the same hash then resolves a route and enqueues a send. Without the route
// population in handlePushRegister, a registered subscription is never woken.
func TestPushRegisterMakesNotifyReach(t *testing.T) {
	on := newDrainServer(t, true, &mockSender{}, 0)
	body := `{"routingEndpointId":"H","subscription":` +
		`{"endpoint":"https://push.example/x","keys":{"p256dh":"p","auth":"a"}}}`
	reg := httptest.NewRequest("POST", contract.PathPushRegister, strings.NewReader(body))
	if rec := do(on.Handler(), reg); rec.Code != 204 {
		t.Fatalf("push register: want 204, got %d", rec.Code)
	}
	if rec := do(on.Handler(), notifyReq("H")); rec.Code != 202 {
		t.Fatalf("notify: want 202, got %d", rec.Code)
	}
	if d := sendDepth(t, on); d != 1 {
		t.Fatalf("notify after push-register should enqueue, depth %d", d)
	}
}

func TestNotifyEnqueueIsGated(t *testing.T) {
	ctx := context.Background()

	off := newDrainServer(t, false, &mockSender{}, 0)
	ok(t, off.st.PutNotifyRoute(ctx, "hash-1", "route-1"))
	if rec := do(off.Handler(), notifyReq("hash-1")); rec.Code != 202 {
		t.Fatalf("notify (off): want 202, got %d", rec.Code)
	}
	if d := sendDepth(t, off); d != 0 {
		t.Fatalf("notify enqueued while gated off, depth %d", d)
	}

	on := newDrainServer(t, true, &mockSender{}, 0)
	ok(t, on.st.PutNotifyRoute(ctx, "hash-1", "route-1"))
	if rec := do(on.Handler(), notifyReq("hash-1")); rec.Code != 202 {
		t.Fatalf("notify (on): want 202, got %d", rec.Code)
	}
	if d := sendDepth(t, on); d != 1 {
		t.Fatalf("notify should enqueue when on, depth %d", d)
	}
}

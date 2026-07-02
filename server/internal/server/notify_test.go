package server

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"sti.care/api/internal/contract"
	"sti.care/api/internal/store"
)

const farFuture = int64(1) << 62

// testHeartbeat is the scheduled cover-broadcast cadence the drain tests run at. A
// drain one full heartbeat after the seeding drain crosses exactly one epoch-grid slot
// boundary, so it fires exactly one scheduled broadcast (see seedThenFire).
const testHeartbeat = time.Hour

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
	srv, _ := newServer(t, Config{
		NotifyEnabled:  enabled,
		Sender:         sender,
		CoverWindow:    coverWindow,
		CoverHeartbeat: testHeartbeat,
	}, nil)
	return srv
}

// seedThenFire drives the scheduled cover broadcast exactly once: a seeding drain at
// t=0 (which sets the heartbeat cursor but fires nothing) followed by a drain one full
// heartbeat later (which crosses one grid boundary and fires one broadcast). With
// CoverWindow 0 the covers are due immediately, so the fire pass also delivers them.
// Any real jobs enqueued due at or before t=0 are consumed by the seed pass; their
// recipients still ride the heartbeat because they are registered push routes.
func seedThenFire(s *Server) {
	ctx := context.Background()
	s.DrainSends(ctx, 0)                            // seed the schedule cursor, no broadcast
	s.DrainSends(ctx, testHeartbeat.Milliseconds()) // cross one grid boundary -> broadcast
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

// registerRoute mirrors handlePushRegister: a real device that enables push both
// registers a subscription (push_endpoint, the broadcast target) AND maps its notify
// token hash to that endpoint (notify_route, identity). The subscription alone is what
// puts the route in the cover-broadcast population; the notify_route mapping is only
// used by the intake path, not the scheduled broadcast.
func registerRoute(t *testing.T, s *Server, route string) {
	t.Helper()
	ctx := context.Background()
	ok(t, s.st.RegisterPush(ctx, route,
		store.PushTarget{Endpoint: "https://push/" + route, P256dh: "k", Auth: "a"}, 1))
	ok(t, s.st.PutNotifyRoute(ctx, route, route))
}

// The core new property (doc 13 §2): the cover broadcast fires on a fixed wall-clock
// cadence REGARDLESS of whether any real wake is pending. With ZERO reals queued, a
// scheduled heartbeat still wakes the whole push population, so a broadcast's existence
// carries no signal that anyone reported.
func TestHeartbeatBroadcastsWithNoRealWakes(t *testing.T) {
	ms := &mockSender{}
	s := newDrainServer(t, true, ms, 0)
	routes := []string{"route-1", "route-2", "route-3"}
	for _, r := range routes {
		registerRoute(t, s, r)
	}
	// No real wake is enqueued at all: the broadcast is purely scheduled.
	seedThenFire(s)

	if ms.count() != len(routes) {
		t.Fatalf("scheduled heartbeat should wake all %d routes with zero reals pending, got %d", len(routes), ms.count())
	}
	if d := coverDepth(t, s); d != 0 {
		t.Fatalf("covers not cleared: %d remain", d)
	}
}

// A wake coming due BETWEEN heartbeats triggers no broadcast on its own: broadcasts are
// purely scheduled. This is the anti-probe property strengthened, a junk token now buys
// ZERO broadcasts at any price, and even a real token does not fire an out-of-schedule
// broadcast (which would re-introduce the timing correlation). The due jobs are still
// consumed so the queue stays bounded; they simply ride the next scheduled heartbeat.
func TestWakeBetweenHeartbeatsTriggersNoBroadcast(t *testing.T) {
	ctx := context.Background()
	ms := &mockSender{}
	s := newDrainServer(t, true, ms, 0)
	for _, r := range []string{"route-1", "route-2"} {
		registerRoute(t, s, r)
	}
	s.DrainSends(ctx, 0) // seed the schedule; nothing fires

	// A junk token AND a real token come due within the same heartbeat slot.
	ok(t, s.st.EnqueueSend(ctx, "probe", 1, 1))
	ok(t, s.st.EnqueueSend(ctx, "route-1", 1, 1))
	s.DrainSends(ctx, 2) // still the seed's heartbeat slot: no boundary crossed

	if ms.count() != 0 {
		t.Fatalf("a wake between heartbeats must not broadcast, got %d", ms.count())
	}
	if d := sendDepth(t, s); d != 0 {
		t.Fatalf("due sends should be scrubbed even without a broadcast, depth %d", d)
	}
	if d := coverDepth(t, s); d != 0 {
		t.Fatalf("no covers should exist between heartbeats, depth %d", d)
	}
}

// A real wake rides the scheduled heartbeat: the recipient is woken as one anonymous
// member of the population-wide broadcast, exactly once, never on a separate direct
// path. There is no marker (an extra delivery, a different route) a delivery observer
// could use to single the recipient out, and the real job is consumed, not delivered
// twice.
func TestRealWakeRidesHeartbeat(t *testing.T) {
	ctx := context.Background()
	ms := &mockSender{}
	s := newDrainServer(t, true, ms, 0)
	population := []string{"route-1", "route-2", "route-3", "route-4"}
	for _, r := range population {
		registerRoute(t, s, r)
	}
	const recipient = "route-2"
	ok(t, s.st.EnqueueSend(ctx, recipient, 0, 0))

	seedThenFire(s)

	delivered := map[string]int{}
	ms.mu.Lock()
	for _, tg := range ms.sent {
		// PushTarget.Endpoint is "https://push/" + route (see registerRoute).
		delivered[strings.TrimPrefix(tg.Endpoint, "https://push/")]++
	}
	ms.mu.Unlock()

	if len(delivered) != len(population) {
		t.Fatalf("delivered set %v is not the full population %v", delivered, population)
	}
	for _, r := range population {
		if delivered[r] != 1 {
			t.Fatalf("route %q delivered %d times, want exactly 1 (indistinguishable from cover)", r, delivered[r])
		}
	}
	if delivered[recipient] != 1 {
		t.Fatalf("real recipient %q woken %d times, want exactly 1", recipient, delivered[recipient])
	}
	// Total deliveries equal the population, not population+1: no extra direct send.
	if got := ms.count(); got != len(population) {
		t.Fatalf("total deliveries = %d, want %d (no extra direct send to the recipient)", got, len(population))
	}
	if d := sendDepth(t, s) + coverDepth(t, s); d != 0 {
		t.Fatalf("queues not drained: %d remain", d)
	}
}

// Several real wakes coming due before a heartbeat collapse to the SINGLE scheduled
// broadcast, never one per recipient: the anti-amplification property. Three reals
// among three routes wake the three routes once each (3 deliveries), not nine.
func TestManyRealWakesRideOneScheduledBroadcast(t *testing.T) {
	ctx := context.Background()
	ms := &mockSender{}
	s := newDrainServer(t, true, ms, 0)
	routes := []string{"route-1", "route-2", "route-3"}
	for _, r := range routes {
		registerRoute(t, s, r)
	}
	ok(t, s.st.EnqueueSend(ctx, "route-1", 0, 0))
	ok(t, s.st.EnqueueSend(ctx, "route-2", 0, 0))
	ok(t, s.st.EnqueueSend(ctx, "route-3", 0, 0))

	seedThenFire(s)

	if ms.count() != len(routes) {
		t.Fatalf("many reals must ride ONE broadcast (%d), not amplify to %d: got %d", len(routes), len(routes)*len(routes), ms.count())
	}
	if d := sendDepth(t, s) + coverDepth(t, s); d != 0 {
		t.Fatalf("queues not drained: %d remain", d)
	}
}

// A non-positive CoverWindow (only reachable by constructing Config directly; the boot
// path clamps it with max(..., 0)) must not panic rand.Int64N when the heartbeat fans
// out covers. This pins the guard that mirrors the republish jitter.
func TestHeartbeatNonPositiveWindowDoesNotPanic(t *testing.T) {
	ms := &mockSender{}
	s := newDrainServer(t, true, ms, -1*time.Millisecond)
	registerRoute(t, s, "route-1")

	seedThenFire(s) // must not panic on the negative window

	if ms.count() != 1 {
		t.Fatalf("want 1 delivery to the single route, got %d", ms.count())
	}
}

// A push population larger than one drain batch is still woken in full: the per-pass
// delivery ceiling spreads the broadcast across passes but loses no one. The heartbeat
// fires once (fanning out the whole population); later passes in the same slot deliver
// the remainder without re-firing.
func TestHeartbeatPopulationLargerThanBatchEventuallyAllWoken(t *testing.T) {
	ctx := context.Background()
	ms := &mockSender{}
	s := newDrainServer(t, true, ms, 0)
	const population = drainBatch + 44 // one full batch plus a remainder
	for i := 0; i < population; i++ {
		registerRoute(t, s, "route-"+strconv.Itoa(i))
	}
	fireAt := testHeartbeat.Milliseconds()
	s.DrainSends(ctx, 0)      // seed
	s.DrainSends(ctx, fireAt) // fire: fan out the whole population, deliver the first batch
	// Later passes in the SAME heartbeat slot deliver the remainder; no re-fire.
	for pass := 0; pass < 5; pass++ {
		s.DrainSends(ctx, fireAt)
	}

	if ms.count() != population {
		t.Fatalf("every route in the population must be woken: want %d, got %d", population, ms.count())
	}
	if d := coverDepth(t, s); d != 0 {
		t.Fatalf("covers not fully drained: %d remain", d)
	}
}

// While the notify gate is OFF the drain is inert: nothing is delivered and the send
// queue is left untouched (handleNotify enqueues nothing while off, so in production it
// stays empty; a directly-enqueued row is not even scrubbed).
func TestCoverWakeGatedOffIsInert(t *testing.T) {
	ctx := context.Background()
	ms := &mockSender{}
	s := newDrainServer(t, false, ms, 0) // gate OFF
	registerRoute(t, s, "route-1")
	ok(t, s.st.EnqueueSend(ctx, "route-1", 100, 100))

	seedThenFire(s)

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

// A non-zero window defers the broadcast: the fire pass schedules covers across the
// window; a pass at the window's end delivers all of them. Asserting on eventual
// completeness keeps the test free of jitter flakiness.
func TestHeartbeatDefersAcrossWindowThenDelivers(t *testing.T) {
	ctx := context.Background()
	ms := &mockSender{}
	const window = 2 * time.Minute
	s := newDrainServer(t, true, ms, window)
	registerRoute(t, s, "route-1")
	registerRoute(t, s, "route-2")

	fireAt := testHeartbeat.Milliseconds()
	s.DrainSends(ctx, 0)      // seed
	s.DrainSends(ctx, fireAt) // fire: schedule the population across the window
	// The window (2 min) is far shorter than the heartbeat (1 h), so this stays in the
	// same slot and does not re-fire; it just delivers every scheduled cover.
	s.DrainSends(ctx, fireAt+window.Milliseconds())

	if ms.count() != 2 {
		t.Fatalf("whole population should eventually wake, got %d", ms.count())
	}
	if d := coverDepth(t, s); d != 0 {
		t.Fatalf("all covers should be delivered, depth %d", d)
	}
}

// A cover whose delivery fails is retained and retried on a later pass; nothing is lost
// on a transient push outage.
func TestHeartbeatRetainsCoverOnDeliveryFailure(t *testing.T) {
	ctx := context.Background()
	ms := &mockSender{err: errors.New("push gateway down")}
	s := newDrainServer(t, true, ms, 0)
	registerRoute(t, s, "route-1")

	fireAt := testHeartbeat.Milliseconds()
	s.DrainSends(ctx, 0)
	s.DrainSends(ctx, fireAt)
	if ms.count() != 1 {
		t.Fatalf("want 1 delivery attempt, got %d", ms.count())
	}
	if d := coverDepth(t, s); d != 1 {
		t.Fatalf("failed cover must be retained for retry, depth %d", d)
	}

	// The gateway recovers; a later pass in the same slot delivers the retained cover.
	ms.setErr(nil)
	s.DrainSends(ctx, fireAt+1)
	if d := coverDepth(t, s); d != 0 {
		t.Fatalf("recovered cover should clear, depth %d", d)
	}
}

// A heartbeat with no push population wakes nobody, and a real wake with no population
// is a clean drop: scrubbed, no covers, no leftover job.
func TestHeartbeatNoPopulationWakesNobody(t *testing.T) {
	ctx := context.Background()
	ms := &mockSender{}
	s := newDrainServer(t, true, ms, 0)
	ok(t, s.st.EnqueueSend(ctx, "orphan-route", 0, 0)) // a real wake, but nobody registered

	seedThenFire(s)

	if ms.count() != 0 {
		t.Fatalf("no push population, nobody to wake, got %d", ms.count())
	}
	if d := sendDepth(t, s) + coverDepth(t, s); d != 0 {
		t.Fatalf("a wake with no population should drop cleanly: %d remain", d)
	}
}

// With intake ON but NO Sender configured (a box without VAPID keys), the drain must
// still reclaim queued real wakes so send_queue can never grow unbounded, and must NOT
// fan out covers there is no transport to deliver, even across a heartbeat boundary. It
// must also not panic dereferencing the nil sender.
func TestDrainReclaimsSendsWithNoSender(t *testing.T) {
	ctx := context.Background()
	s := newDrainServer(t, true, nil, 0) // enabled, but no Sender
	registerRoute(t, s, "route-1")
	ok(t, s.st.EnqueueSend(ctx, "route-1", 0, 0)) // a real, resolvable wake
	ok(t, s.st.EnqueueSend(ctx, "probe", 0, 0))   // an unknown token

	seedThenFire(s)

	if d := sendDepth(t, s); d != 0 {
		t.Fatalf("send queue must drain with no sender, depth %d", d)
	}
	if d := coverDepth(t, s); d != 0 {
		t.Fatalf("no covers should be fanned out with no sender, depth %d", d)
	}
}

// A push service reporting a subscription gone (404/410 -> ErrSubscriptionGone) prunes
// that endpoint and clears the cover, rather than retaining it for a retry that could
// only fail again and keeping a dead route in every future broadcast.
func TestHeartbeatPrunesGoneSubscription(t *testing.T) {
	ctx := context.Background()
	ms := &mockSender{err: ErrSubscriptionGone}
	s := newDrainServer(t, true, ms, 0)
	registerRoute(t, s, "route-1")

	seedThenFire(s)

	if ms.count() != 1 {
		t.Fatalf("want 1 delivery attempt, got %d", ms.count())
	}
	eps, err := s.st.PushEndpoints(ctx, "route-1")
	ok(t, err)
	if len(eps) != 0 {
		t.Fatalf("gone subscription should be pruned, %d remain", len(eps))
	}
	if d := coverDepth(t, s); d != 0 {
		t.Fatalf("cover must clear after pruning a gone target, depth %d", d)
	}
}

func notifyReq(tokenHash string) *http.Request {
	return httptest.NewRequest("POST", contract.PathNotify,
		strings.NewReader(`{"tokenHash":"`+tokenHash+`"}`))
}

// Registering a push subscription must also make the device reachable: a notify for the
// same hash then enqueues a send (the intake path is constant-time and never looks the
// route up). Without the route population in handlePushRegister a registered
// subscription would never be woken.
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

// The global push-register cap sheds a distributed flood of subscriptions across ALL
// callers: with a tiny global budget but a generous per-IP one, registrations from
// distinct IPs share the one bucket, so the (burst+1)th is a 429 regardless of who
// sends it. This bounds inflation of the notify cover-broadcast population.
func TestPushRegisterGlobalRateLimit(t *testing.T) {
	srv, _ := newServer(t, Config{
		IPRatePerSec:             1000, // generous, so the per-IP cap never trips first
		IPBurst:                  1000,
		PushRegisterGlobalPerSec: 0.000001,
		PushRegisterGlobalBurst:  2,
	}, func() int64 { return 1000 })
	h := srv.Handler()

	reg := func(ip string) int {
		body := `{"routingEndpointId":"H","subscription":` +
			`{"endpoint":"https://push.example/x","keys":{"p256dh":"p","auth":"a"}}}`
		req := httptest.NewRequest("POST", contract.PathPushRegister, strings.NewReader(body))
		req.Header.Set("X-Real-IP", ip) // a DIFFERENT IP each call
		return do(h, req).Code
	}
	// Two registrations drain the global burst (each a real 204);
	if c := reg("1.1.1.1"); c != http.StatusNoContent {
		t.Fatalf("register 1: %d, want 204", c)
	}
	if c := reg("2.2.2.2"); c != http.StatusNoContent {
		t.Fatalf("register 2: %d, want 204", c)
	}
	// the third, from yet another IP, is shed by the shared global bucket.
	if c := reg("3.3.3.3"); c != http.StatusTooManyRequests {
		t.Fatalf("register 3 (different IP): %d, want 429", c)
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

// Constant-time intake (doc 10 §F): a notify for a REGISTERED token and one for an
// UNKNOWN token do identical work, each enqueuing exactly one send. The request never
// looks the route up, so its timing carries no existence oracle on the notify routes.
// (Wall-clock equality can't be asserted in a unit test; pinning identical DB work is
// the mechanism that makes the timing uniform.) The drain then broadcasts on a fixed
// schedule regardless of which of these tokens is real, so neither one leaks by its
// effect on the broadcast either.
func TestNotifyIntakeIsConstantTime(t *testing.T) {
	s := newDrainServer(t, true, &mockSender{}, 0)
	registerRoute(t, s, "known-token") // a real, resolvable route

	if rec := do(s.Handler(), notifyReq("known-token")); rec.Code != 202 {
		t.Fatalf("notify (known): want 202, got %d", rec.Code)
	}
	if rec := do(s.Handler(), notifyReq("totally-unknown-token")); rec.Code != 202 {
		t.Fatalf("notify (unknown): want 202, got %d", rec.Code)
	}
	// Both enqueued one send each: the request did the same work regardless of whether
	// the token resolves to a route.
	if d := sendDepth(t, s); d != 2 {
		t.Fatalf("known and unknown should each enqueue one send, depth %d", d)
	}
}

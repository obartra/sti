package server

import (
	"context"
	"errors"
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

func newDrainServer(t *testing.T, enabled bool, sender Sender) *Server {
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
	return New(st, Config{DecoySecret: secret, NotifyEnabled: enabled, Sender: sender},
		slog.New(slog.NewTextHandler(io.Discard, nil)), nil)
}

func ok(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatal(err)
	}
}

func queueDepth(t *testing.T, s *Server) int {
	t.Helper()
	due, err := s.st.DueSends(context.Background(), farFuture, 1024)
	ok(t, err)
	return len(due)
}

func TestDrainSendsDeliversAndClears(t *testing.T) {
	ctx := context.Background()
	ms := &mockSender{}
	s := newDrainServer(t, true, ms)
	ok(t, s.st.RegisterPush(ctx, "route-1",
		store.PushTarget{Endpoint: "https://push/1", P256dh: "k", Auth: "a"}, 1))
	ok(t, s.st.EnqueueSend(ctx, "route-1", 100, 100))

	s.DrainSends(ctx, 200)

	if ms.count() != 1 {
		t.Fatalf("want 1 wake delivered, got %d", ms.count())
	}
	if d := queueDepth(t, s); d != 0 {
		t.Fatalf("delivered job not removed: %d remain", d)
	}
}

func TestDrainSendsGatedOffIsInert(t *testing.T) {
	ctx := context.Background()
	ms := &mockSender{}
	s := newDrainServer(t, false, ms) // gate OFF
	ok(t, s.st.RegisterPush(ctx, "route-1",
		store.PushTarget{Endpoint: "https://push/1", P256dh: "k", Auth: "a"}, 1))
	ok(t, s.st.EnqueueSend(ctx, "route-1", 100, 100))

	s.DrainSends(ctx, 200)

	if ms.count() != 0 {
		t.Fatalf("delivered while gated off: %d", ms.count())
	}
	if d := queueDepth(t, s); d != 1 {
		t.Fatalf("queue should be untouched while off, depth %d", d)
	}
}

func TestDrainSendsRetainsJobOnDeliveryFailure(t *testing.T) {
	ctx := context.Background()
	ms := &mockSender{err: errors.New("push gateway down")}
	s := newDrainServer(t, true, ms)
	ok(t, s.st.RegisterPush(ctx, "route-1",
		store.PushTarget{Endpoint: "https://push/1", P256dh: "k", Auth: "a"}, 1))
	ok(t, s.st.EnqueueSend(ctx, "route-1", 100, 100))

	s.DrainSends(ctx, 200)

	if ms.count() != 1 {
		t.Fatalf("want 1 delivery attempt, got %d", ms.count())
	}
	if d := queueDepth(t, s); d != 1 {
		t.Fatalf("failed job must be retained for retry, depth %d", d)
	}
}

func TestDrainSendsDropsJobWithNoSubscribers(t *testing.T) {
	ctx := context.Background()
	ms := &mockSender{}
	s := newDrainServer(t, true, ms)
	// A route with a queued wake but no registered push subscription.
	ok(t, s.st.EnqueueSend(ctx, "orphan-route", 100, 100))

	s.DrainSends(ctx, 200)

	if ms.count() != 0 {
		t.Fatalf("nothing to deliver, got %d", ms.count())
	}
	if d := queueDepth(t, s); d != 0 {
		t.Fatalf("a wake with no subscriber should be dropped, depth %d", d)
	}
}

func notifyReq(tokenHash string) *http.Request {
	return httptest.NewRequest("POST", contract.PathNotify,
		strings.NewReader(`{"tokenHash":"`+tokenHash+`"}`))
}

func TestNotifyEnqueueIsGated(t *testing.T) {
	ctx := context.Background()

	off := newDrainServer(t, false, &mockSender{})
	ok(t, off.st.PutNotifyRoute(ctx, "hash-1", "route-1"))
	if rec := do(off.Handler(), notifyReq("hash-1")); rec.Code != 202 {
		t.Fatalf("notify (off): want 202, got %d", rec.Code)
	}
	if d := queueDepth(t, off); d != 0 {
		t.Fatalf("notify enqueued while gated off, depth %d", d)
	}

	on := newDrainServer(t, true, &mockSender{})
	ok(t, on.st.PutNotifyRoute(ctx, "hash-1", "route-1"))
	if rec := do(on.Handler(), notifyReq("hash-1")); rec.Code != 202 {
		t.Fatalf("notify (on): want 202, got %d", rec.Code)
	}
	if d := queueDepth(t, on); d != 1 {
		t.Fatalf("notify should enqueue when on, depth %d", d)
	}
}

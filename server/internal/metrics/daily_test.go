package metrics

import (
	"testing"
	"time"
)

// The per-day buckets (doc 20): errors and requests stamp the current UTC day,
// the window zero-fills and prunes, clear zeroes lifetime totals but not the
// history, and the buckets ride the snapshot across a restart.

func atDay(day int64) time.Time {
	return time.UnixMilli(day*dayMs + dayMs/2).UTC()
}

func TestDailyBucketsStampTheCurrentDay(t *testing.T) {
	m := New()
	day := int64(20_000)
	m.SetNow(func() time.Time { return atDay(day) })

	m.Error(ErrJanitor)
	m.Error(ErrJanitor)
	m.Error(ErrStore)
	m.Observe("GET", "/healthz", 200, 0.001)

	m.SetNow(func() time.Time { return atDay(day + 1) })
	m.Error(ErrJanitor)

	days := m.Daily(2)
	if len(days) != 2 {
		t.Fatalf("want 2 days, got %d", len(days))
	}
	first, second := days[0], days[1]
	if first.Day != day || second.Day != day+1 {
		t.Fatalf("days out of order: %d, %d", first.Day, second.Day)
	}
	if first.Counts[ErrJanitor] != 2 || first.Counts[ErrStore] != 1 || first.Requests != 1 {
		t.Fatalf("first day wrong: %+v", first)
	}
	if second.Counts[ErrJanitor] != 1 || second.Requests != 0 {
		t.Fatalf("second day wrong: %+v", second)
	}
}

func TestDailyZeroFillsTheWindow(t *testing.T) {
	m := New()
	day := int64(20_000)
	m.SetNow(func() time.Time { return atDay(day) })
	m.Error(ErrDecode)

	days := m.Daily(7)
	if len(days) != 7 {
		t.Fatalf("want a zero-filled window of 7, got %d", len(days))
	}
	for i, d := range days[:6] {
		if d.Day != day-6+int64(i) || d.Counts[ErrDecode] != 0 {
			t.Fatalf("day %d not zero-filled: %+v", i, d)
		}
	}
	if days[6].Counts[ErrDecode] != 1 {
		t.Fatalf("today's count missing: %+v", days[6])
	}
}

func TestDailyPrunesBeyondTheWindow(t *testing.T) {
	m := New()
	day := int64(20_000)
	m.SetNow(func() time.Time { return atDay(day) })
	m.Error(ErrStore)

	// Cross far past the retention window; the old bucket is dropped on the
	// next write.
	m.SetNow(func() time.Time { return atDay(day + dailyWindowDays + 5) })
	m.Error(ErrStore)

	m.daily.mu.Lock()
	_, oldKept := m.daily.days[day]
	m.daily.mu.Unlock()
	if oldKept {
		t.Fatal("bucket older than the window was not pruned")
	}
}

func TestErrorsTodayAndClear(t *testing.T) {
	m := New()
	day := int64(20_000)
	m.SetNow(func() time.Time { return atDay(day) })
	m.Error(ErrJanitor)
	m.Error(ErrJanitor)

	byType := func(cs []ErrorCount) map[string]int64 {
		out := map[string]int64{}
		for _, c := range cs {
			out[c.Type] = c.Count
		}
		return out
	}
	if got := byType(m.ErrorsToday())["janitor"]; got != 2 {
		t.Fatalf("errors today = %d, want 2", got)
	}
	if got := byType(m.Health().Errors)["janitor"]; got != 2 {
		t.Fatalf("lifetime total = %d, want 2", got)
	}

	// Clear zeroes the lifetime totals; today's bucket (the history) stays.
	m.ClearErrors()
	if got := byType(m.Health().Errors)["janitor"]; got != 0 {
		t.Fatalf("lifetime total after clear = %d, want 0", got)
	}
	if got := byType(m.ErrorsToday())["janitor"]; got != 2 {
		t.Fatalf("today's bucket after clear = %d, want 2 (history stays)", got)
	}
}

func TestDailySurvivesSnapshotRestore(t *testing.T) {
	m := New()
	day := int64(20_000)
	m.SetNow(func() time.Time { return atDay(day) })
	m.Error(ErrEnqueue)
	m.Observe("GET", "/healthz", 200, 0.001)

	b, err := m.Snapshot()
	if err != nil {
		t.Fatal(err)
	}
	m2 := New()
	m2.SetNow(func() time.Time { return atDay(day) })
	if err := m2.Restore(b); err != nil {
		t.Fatal(err)
	}
	days := m2.Daily(1)
	if len(days) != 1 || days[0].Counts[ErrEnqueue] != 1 || days[0].Requests != 1 {
		t.Fatalf("daily buckets did not survive restore: %+v", days)
	}
}

func TestRestoreSkipsUnknownSubsystems(t *testing.T) {
	m := New()
	// A future binary's file with a subsystem this one doesn't know.
	file := []byte(`{"version":1,"series":[],"days":[{"day":20000,"errors":{"quantum":9,"store":2},"requests":4}]}`)
	if err := m.Restore(file); err != nil {
		t.Fatal(err)
	}
	m.SetNow(func() time.Time { return atDay(20_000) })
	days := m.Daily(1)
	if days[0].Counts[ErrStore] != 2 || days[0].Requests != 4 {
		t.Fatalf("known fields not restored: %+v", days[0])
	}
	for et, n := range days[0].Counts {
		if string(et) == "quantum" && n != 0 {
			t.Fatal("unknown subsystem leaked into the counts")
		}
	}
}

func TestLatencyTotalAggregatesAcrossEndpoints(t *testing.T) {
	m := New()
	m.Observe("GET", "/healthz", 200, 0.0005) // < 1ms bucket
	m.Observe("GET", "/vapid", 200, 0.0005)   // different endpoint, same bucket
	m.Observe("GET", "/healthz", 200, 10)     // overflow

	underMs, counts := m.LatencyTotal()
	if len(underMs) != len(counts) {
		t.Fatalf("shape mismatch: %d bounds vs %d counts", len(underMs), len(counts))
	}
	if underMs[0] != 1 || counts[0] != 2 {
		t.Fatalf("fastest bucket wrong: underMs=%d count=%d", underMs[0], counts[0])
	}
	last := len(counts) - 1
	if underMs[last] != 0 || counts[last] != 1 {
		t.Fatalf("overflow bucket wrong: underMs=%d count=%d", underMs[last], counts[last])
	}
}

package metrics

import (
	"sort"
	"sync"
	"time"
)

// Per-day aggregate buckets (doc 20): how many internal errors (by subsystem)
// and how many HTTP requests landed on each recent UTC day, so the admin
// console can chart error tracking and traffic over time instead of showing
// only lifetime totals. Same blind rules as everything here: counts of events
// per fixed subsystem per day, never a per-account or per-id figure. The
// buckets ride the existing metrics snapshot, so they survive restarts, and
// they are pruned to a fixed window so the file never grows unbounded.

// dailyWindowDays is how many UTC days of buckets are kept (matches the trends
// window the console charts).
const dailyWindowDays = 90

const dayMs = int64(24 * time.Hour / time.Millisecond)

// dayBucket is one UTC epoch-day of counts.
type dayBucket struct {
	errors   map[ErrorType]int64
	requests int64
}

// dailyStore is the mutex-guarded map of recent day buckets. Error paths are
// rare and the request path takes one short critical section per request,
// which is negligible next to the handler work around it.
type dailyStore struct {
	mu   sync.Mutex
	days map[int64]*dayBucket
}

func newDailyStore() *dailyStore {
	return &dailyStore{days: map[int64]*dayBucket{}}
}

// bucketFor returns (creating if needed) the bucket for an epoch-day and
// prunes anything older than the window. Callers hold no lock; this takes it.
func (d *dailyStore) bucketFor(day int64) *dayBucket {
	b, ok := d.days[day]
	if !ok {
		b = &dayBucket{errors: map[ErrorType]int64{}}
		d.days[day] = b
		for old := range d.days {
			if old <= day-dailyWindowDays {
				delete(d.days, old)
			}
		}
	}
	return b
}

func (d *dailyStore) bumpError(day int64, t ErrorType) {
	d.mu.Lock()
	d.bucketFor(day).errors[t]++
	d.mu.Unlock()
}

func (d *dailyStore) bumpRequest(day int64) {
	d.mu.Lock()
	d.bucketFor(day).requests++
	d.mu.Unlock()
}

// epochDay converts a wall-clock instant to UTC days since the Unix epoch,
// the same bucket the trends series use.
func epochDay(t time.Time) int64 {
	return t.UTC().UnixMilli() / dayMs
}

// now returns the metrics clock: injectable for tests, wall time otherwise.
func (m *Metrics) now() time.Time {
	if m.nowFn != nil {
		return m.nowFn()
	}
	return time.Now()
}

// SetNow injects the clock the daily buckets stamp with. Tests only.
func (m *Metrics) SetNow(fn func() time.Time) { m.nowFn = fn }

// DayErrors is one day's internal-error counts by fixed subsystem, plus the
// request total for the same day.
type DayErrors struct {
	Day      int64
	Counts   map[ErrorType]int64
	Requests int64
}

// Daily returns the last windowDays of buckets, oldest first, zero-filled so
// every day in the window is present (charts want a continuous axis). Counts
// maps are copies; callers may mutate freely.
func (m *Metrics) Daily(windowDays int) []DayErrors {
	if windowDays < 1 {
		windowDays = 1
	}
	if windowDays > dailyWindowDays {
		windowDays = dailyWindowDays
	}
	today := epochDay(m.now())
	m.daily.mu.Lock()
	defer m.daily.mu.Unlock()
	out := make([]DayErrors, 0, windowDays)
	for day := today - int64(windowDays) + 1; day <= today; day++ {
		e := DayErrors{Day: day, Counts: map[ErrorType]int64{}}
		for _, et := range allErrorTypes {
			e.Counts[et] = 0
		}
		if b, ok := m.daily.days[day]; ok {
			for t, n := range b.errors {
				e.Counts[t] = n
			}
			e.Requests = b.requests
		}
		out = append(out, e)
	}
	return out
}

// ErrorsToday is today's bucket only, in the fixed subsystem order, for the
// health snapshot's "is it on fire right now" read.
func (m *Metrics) ErrorsToday() []ErrorCount {
	today := epochDay(m.now())
	m.daily.mu.Lock()
	defer m.daily.mu.Unlock()
	out := make([]ErrorCount, len(allErrorTypes))
	b := m.daily.days[today]
	for i, et := range allErrorTypes {
		var n int64
		if b != nil {
			n = b.errors[et]
		}
		out[i] = ErrorCount{Type: string(et), Count: n}
	}
	return out
}

// ClearErrors zeroes the lifetime error counters. The daily buckets stay: they
// are the record; clearing answers "start the headline number fresh", not
// "erase history". The box's alert scrape tolerates the decrease (it skips a
// delta window when a counter shrinks).
func (m *Metrics) ClearErrors() {
	for _, et := range allErrorTypes {
		m.errors[et].store(0)
	}
}

// LatencyTotal aggregates the request-duration histogram across endpoint
// templates: per-bucket counts (not cumulative) with each bucket's upper bound
// in milliseconds, plus a trailing overflow bucket flagged with bound 0 (the
// same "older/slower" convention the review-latency series uses). Endpoint
// templates are fixed code constants, so summing them loses nothing private.
func (m *Metrics) LatencyTotal() (underMs []int64, counts []int64) {
	n := len(durationBuckets)
	counts = make([]int64, n+1)
	for _, h := range m.durations {
		bc := h.bucketCounts()
		for i := 0; i < len(bc) && i <= n; i++ {
			counts[i] += bc[i]
		}
	}
	underMs = make([]int64, n+1)
	for i, b := range durationBuckets {
		underMs[i] = int64(b * 1000)
	}
	underMs[n] = 0 // overflow: slower than the last bound
	return underMs, counts
}

// --- persistence -------------------------------------------------------------

// dayDump is one day bucket in the metrics snapshot file. Aggregate counts per
// fixed subsystem name; as blind as every other series in the dump.
type dayDump struct {
	Day      int64            `json:"day"`
	Errors   map[string]int64 `json:"errors,omitempty"`
	Requests int64            `json:"requests,omitempty"`
}

func (d *dailyStore) snapshot() []dayDump {
	d.mu.Lock()
	defer d.mu.Unlock()
	out := make([]dayDump, 0, len(d.days))
	for day, b := range d.days {
		dd := dayDump{Day: day, Requests: b.requests}
		if len(b.errors) > 0 {
			dd.Errors = make(map[string]int64, len(b.errors))
			for t, n := range b.errors {
				dd.Errors[string(t)] = n
			}
		}
		out = append(out, dd)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Day < out[j].Day })
	return out
}

// restore loads day buckets from a snapshot. Unknown subsystem names are
// skipped (an old binary reading a newer file, or vice versa, never breaks
// startup, matching the series restore's tolerance).
func (d *dailyStore) restore(days []dayDump) {
	known := map[string]ErrorType{}
	for _, et := range allErrorTypes {
		known[string(et)] = et
	}
	d.mu.Lock()
	defer d.mu.Unlock()
	for _, dd := range days {
		b := &dayBucket{errors: map[ErrorType]int64{}, requests: dd.Requests}
		for name, n := range dd.Errors {
			if et, ok := known[name]; ok {
				b.errors[et] = n
			}
		}
		d.days[dd.Day] = b
	}
}

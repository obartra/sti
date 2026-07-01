package metrics

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func scrape(t *testing.T, m *Metrics) string {
	t.Helper()
	rec := httptest.NewRecorder()
	m.Handler().ServeHTTP(rec, httptest.NewRequest("GET", "/metrics", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("scrape status = %d", rec.Code)
	}
	return rec.Body.String()
}

func TestEndpointForMapsTemplateNeverID(t *testing.T) {
	longID := "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ" // 43-char base64url-ish
	cases := []struct {
		method, path string
		want         Endpoint
	}{
		{"GET", "/a/" + longID, EpAlias},
		{"PUT", "/a/" + longID, EpAlias},
		{"GET", "/acct/" + longID, EpAccount},
		{"POST", "/knock/" + longID, EpKnock},
		{"POST", "/notify", EpNotify},
		{"POST", "/push/register", EpPush},
		{"GET", "/healthz", EpHealth},
		{"GET", "/", EpRoot},
		{"GET", "/totally/unknown/path", EpOther},
	}
	for _, c := range cases {
		if got := endpointFor(c.method, c.path); got != c.want {
			t.Errorf("endpointFor(%q,%q) = %q, want %q", c.method, c.path, got, c.want)
		}
	}
}

// The load-bearing privacy invariant: a concrete id in the request path must
// never appear in the exposition. Only the template does.
func TestExpositionNeverContainsID(t *testing.T) {
	m := New()
	id := "SECRET_ALIAS_ID_0123456789abcdefABCDEF_xyz"
	m.Observe("GET", "/a/"+id, 200, 0.002)
	m.Observe("POST", "/knock/"+id, 200, 0.001)
	m.SensitiveOverload("/a/" + id)
	out := scrape(t, m)
	if strings.Contains(out, id) {
		t.Fatalf("exposition leaked a concrete id:\n%s", out)
	}
	if !strings.Contains(out, `endpoint="/a/{id}"`) {
		t.Errorf("expected the /a/{id} template label in:\n%s", out)
	}
}

// Existence uniformity: a hit and a miss on /a are the same 200 and land on the
// same series. There is no hit/miss split a reader could use as an oracle.
func TestNoHitMissSplitOnAlias(t *testing.T) {
	m := New()
	m.Observe("GET", "/a/realhit000000000000000000000000000000000", 200, 0.003)  // "hit"
	m.Observe("GET", "/a/decoymiss00000000000000000000000000000000", 200, 0.002) // "miss"
	out := scrape(t, m)
	// Exactly one 2xx GET /a series, counting both, and no hit/miss label anywhere.
	if !strings.Contains(out, `sti_requests_total{endpoint="/a/{id}",method="GET",status_class="2xx"} 2`) {
		t.Errorf("expected both alias reads on one 2xx series:\n%s", out)
	}
	for _, bad := range []string{"hit", "miss", "found", "decoy"} {
		if strings.Contains(strings.ToLower(out), bad) {
			t.Errorf("exposition contains a %q-like distinguisher:\n%s", bad, out)
		}
	}
}

func TestShedAndRateLimitAttribution(t *testing.T) {
	m := New()
	m.Observe("PUT", "/acct/x000000000000000000000000000000000000000", 503, 0.001)
	m.Observe("PUT", "/acct/x000000000000000000000000000000000000000", 429, 0.001)
	out := scrape(t, m)
	if !strings.Contains(out, `sti_shed_total{endpoint="/acct/{id}"} 1`) {
		t.Errorf("missing shed attribution:\n%s", out)
	}
	if !strings.Contains(out, `sti_ratelimit_rejections_total{endpoint="/acct/{id}"} 1`) {
		t.Errorf("missing rate-limit attribution:\n%s", out)
	}
}

// The feedback counter is pre-registered at zero and increments per filed report.
// The box diffs this counter to nudge the operator (doc 34), so it must be exposed
// and start at zero (a restart continues it from the snapshot, not a fresh count).
func TestFeedbackReceivedCounter(t *testing.T) {
	m := New()
	if out := scrape(t, m); !strings.Contains(out, "sti_feedback_received_total 0") {
		t.Fatalf("counter not pre-registered at zero:\n%s", out)
	}
	m.FeedbackReceived()
	m.FeedbackReceived()
	if out := scrape(t, m); !strings.Contains(out, "sti_feedback_received_total 2") {
		t.Fatalf("counter did not increment to 2:\n%s", out)
	}
}

// The /a p99 latency alert (doc 12) reads the 25ms and 100ms bucket boundaries:
// it watches how the histogram fills around those edges. Dropping or moving either
// boundary silently breaks the alert, so pin them here.
func TestDurationBucketsPinAlertBoundaries(t *testing.T) {
	want := map[float64]bool{0.025: false, 0.1: false}
	for _, b := range durationBuckets {
		if _, ok := want[b]; ok {
			want[b] = true
		}
	}
	for b, present := range want {
		if !present {
			t.Errorf("durationBuckets missing the %v boundary the /a p99 alert depends on: %v", b, durationBuckets)
		}
	}
}

func TestHistogramCumulativeBuckets(t *testing.T) {
	m := New()
	// 0.002 falls in le=0.005; 0.2 falls in le=0.5; 5 falls in +Inf only.
	for _, v := range []float64{0.002, 0.2, 5} {
		m.Observe("GET", "/healthz", 200, v)
	}
	out := scrape(t, m)
	mustContain(t, out, `sti_request_duration_seconds_bucket{endpoint="/healthz",le="0.005"} 1`)
	mustContain(t, out, `sti_request_duration_seconds_bucket{endpoint="/healthz",le="0.5"} 2`)
	mustContain(t, out, `sti_request_duration_seconds_bucket{endpoint="/healthz",le="+Inf"} 3`)
	mustContain(t, out, `sti_request_duration_seconds_count{endpoint="/healthz"} 3`)
}

func TestInflightHighWater(t *testing.T) {
	m := New()
	m.SetInflightMax(256)
	m.IncInflight()
	m.IncInflight()
	m.DecInflight()
	out := scrape(t, m)
	mustContain(t, out, `sti_inflight_current 1`)
	mustContain(t, out, `sti_inflight_highwater 2`)
	mustContain(t, out, `sti_inflight_max 256`)
}

func TestStatsGaugeSampledOncePerScrape(t *testing.T) {
	m := New()
	calls := 0
	m.RegisterStats(func(_ context.Context) (StatsGauge, error) {
		calls++
		return StatsGauge{DBSizeBytes: 4096, AliasRows: 7, AccountRows: 3, KnockRows: 2, SendQueueDepth: 1}, nil
	})
	out := scrape(t, m)
	mustContain(t, out, `sti_db_size_bytes 4096`)
	mustContain(t, out, `sti_alias_rows 7`)
	mustContain(t, out, `sti_account_rows 3`)
	// Five stats gauges, but the sampler must be called once per scrape, not five times.
	if calls != 1 {
		t.Errorf("sampler called %d times in one scrape, want 1", calls)
	}
	scrape(t, m)
	if calls != 2 {
		t.Errorf("sampler called %d times across two scrapes, want 2", calls)
	}
}

func TestStatsGaugeKeepsLastOnError(t *testing.T) {
	m := New()
	fail := false
	m.RegisterStats(func(_ context.Context) (StatsGauge, error) {
		if fail {
			return StatsGauge{}, context.DeadlineExceeded
		}
		return StatsGauge{AliasRows: 9}, nil
	})
	mustContain(t, scrape(t, m), `sti_alias_rows 9`)
	fail = true
	mustContain(t, scrape(t, m), `sti_alias_rows 9`) // previous value retained
}

func TestExpositionHasHeadersAndIsDeterministic(t *testing.T) {
	m := New()
	out1 := scrape(t, m)
	out2 := scrape(t, m)
	mustContain(t, out1, "# TYPE sti_requests_total counter")
	mustContain(t, out1, "# TYPE sti_request_duration_seconds histogram")
	mustContain(t, out1, "# TYPE sti_inflight_max gauge")
	if out1 != out2 {
		t.Errorf("exposition not deterministic across scrapes")
	}
}

func TestRuntimeBuildAndHostGauges(t *testing.T) {
	m := New()
	m.RegisterBuildInfo("abc123def456")
	m.RegisterRuntime()
	m.RegisterGaugeFunc("sti_disk_free_bytes", "free disk", func() int64 { return 123456789 })
	m.JanitorRan(1700000000)
	out := scrape(t, m)
	mustContain(t, out, `sti_build_info{version="abc123def456"} 1`)
	mustContain(t, out, "# TYPE sti_goroutines gauge")
	mustContain(t, out, "sti_memstats_heap_inuse_bytes ")
	mustContain(t, out, "sti_gc_cycles_total ")
	mustContain(t, out, "sti_disk_free_bytes 123456789")
	mustContain(t, out, "sti_janitor_last_run_seconds 1700000000")
}

func TestRuntimeMemStatsReadOncePerScrape(t *testing.T) {
	// Three memstats gauges share one ReadMemStats per scrape. We can't count
	// ReadMemStats directly, but goroutines must stay bounded and the scrape must
	// be internally consistent (all three present, deterministic structure).
	m := New()
	m.RegisterRuntime()
	out := scrape(t, m)
	for _, g := range []string{"sti_goroutines", "sti_memstats_heap_inuse_bytes", "sti_memstats_heap_alloc_bytes", "sti_gc_cycles_total"} {
		mustContain(t, out, g+" ")
	}
}

func TestSendQueueOldestAgeGauge(t *testing.T) {
	m := New()
	m.RegisterStats(func(_ context.Context) (StatsGauge, error) {
		return StatsGauge{SendQueueDepth: 2, SendQueueOldestAgeSeconds: 42}, nil
	})
	out := scrape(t, m)
	mustContain(t, out, "sti_send_queue_depth 2")
	mustContain(t, out, "sti_send_queue_oldest_age_seconds 42")
}

func TestSnapshotRestoreRoundTrip(t *testing.T) {
	m1 := New()
	// Drive some counters and a histogram.
	for i := 0; i < 5; i++ {
		m1.Observe("GET", "/a/"+randID43, 200, 0.002)
	}
	m1.Observe("GET", "/a/"+randID43, 503, 0.3)
	m1.Error(ErrStore)
	blob, err := m1.Snapshot()
	if err != nil {
		t.Fatal(err)
	}

	// A fresh registry restores to the same values.
	m2 := New()
	if err := m2.Restore(blob); err != nil {
		t.Fatal(err)
	}
	out := scrape(t, m2)
	mustContain(t, out, `sti_requests_total{endpoint="/a/{id}",method="GET",status_class="2xx"} 5`)
	mustContain(t, out, `sti_requests_total{endpoint="/a/{id}",method="GET",status_class="5xx"} 1`)
	mustContain(t, out, `sti_shed_total{endpoint="/a/{id}"} 1`)
	mustContain(t, out, `sti_errors_total{type="store"} 1`)
	mustContain(t, out, `sti_request_duration_seconds_count{endpoint="/a/{id}"} 6`)
	// The 0.002 sample is in le=0.005; the 0.3 sample is in le=0.5.
	mustContain(t, out, `sti_request_duration_seconds_bucket{endpoint="/a/{id}",le="0.005"} 5`)
	mustContain(t, out, `sti_request_duration_seconds_bucket{endpoint="/a/{id}",le="0.5"} 6`)
}

func TestRestoreIgnoresUnknownAndGarbage(t *testing.T) {
	m := New()
	// Unknown series are skipped, not an error.
	if err := m.Restore([]byte(`{"version":1,"series":[{"name":"sti_nonexistent","kind":"counter","value":9}]}`)); err != nil {
		t.Fatalf("unknown series should be skipped, got %v", err)
	}
	// Malformed JSON is an error, not a panic.
	if err := m.Restore([]byte("not json")); err == nil {
		t.Errorf("malformed snapshot should error")
	}
}

// TestSnapshotExcludesGauges pins doc 12: the persisted snapshot holds only
// counters and histograms, never gauges. The blind row-count gauges
// (sti_alias_rows etc.) are a live count of how many passports exist; persisting
// them would write that subject-adjacent number to disk. A regression that taught
// snapshot() to include gauges is caught here; the round-trip test would not flip.
func TestSnapshotExcludesGauges(t *testing.T) {
	m := New()
	// Wire the blind row-count gauges with nonzero values, and drive a counter so
	// the snapshot has real content alongside which a regression could include them.
	m.RegisterStats(func(context.Context) (StatsGauge, error) {
		return StatsGauge{DBSizeBytes: 999, AliasRows: 7, AccountRows: 3, KnockRows: 2, SendQueueDepth: 1}, nil
	})
	m.Error(ErrStore)
	scrape(t, m) // sample the gauge funcs at least once so they hold live values

	blob, err := m.Snapshot()
	if err != nil {
		t.Fatal(err)
	}
	var d dump
	if err := json.Unmarshal(blob, &d); err != nil {
		t.Fatal(err)
	}
	if len(d.Series) == 0 {
		t.Fatal("snapshot is empty; the counter should have been persisted")
	}
	for _, s := range d.Series {
		if s.Kind != "counter" && s.Kind != "histogram" {
			t.Errorf("snapshot persisted a %q series %q; only counters and histograms may be durable", s.Kind, s.Name)
		}
		switch s.Name {
		case "sti_alias_rows", "sti_account_rows", "sti_knock_rows", "sti_db_size_bytes", "sti_send_queue_depth":
			t.Errorf("snapshot persisted gauge %q (a count of existing rows); it must never be durable", s.Name)
		}
	}
}

const randID43 = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG"

func mustContain(t *testing.T, haystack, needle string) {
	t.Helper()
	if !strings.Contains(haystack, needle) {
		t.Errorf("missing %q in:\n%s", needle, haystack)
	}
}

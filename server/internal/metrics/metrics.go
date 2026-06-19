// Package metrics is the blind backend's self-observability layer: aggregate
// counters, gauges, and histograms exposed in Prometheus text format on a
// loopback-only endpoint. It carries telemetry about the SYSTEM, never about the
// SUBJECT (labs/docs/12-observability-and-metrics.md).
//
// Cardinality is bounded BY CONSTRUCTION. The only labels are a fixed set of
// route templates (never a concrete path, so an opaque id can never become a
// label), a small status-class set, and a small error-type set. Every series is
// pre-registered at New, so each exists at zero from t=0 (alerts fire on a real
// reading, not on a missing series), and no runtime input can mint a new series.
// Nothing here ever holds an id, IP, request body, token, or hash.
package metrics

import (
	"context"
	"io"
	"math"
	"net/http"
	"runtime"
	"sort"
	"strconv"
	"sync"
	"sync/atomic"
)

// Endpoint is a bounded route-template label value. It is the template, e.g.
// "/a/{id}", NEVER the concrete path "/a/<id>", so an alias id can never leak
// into a metric. endpointFor maps a request onto exactly one of these.
type Endpoint string

const (
	EpAlias   Endpoint = "/a/{id}"
	EpAccount Endpoint = "/acct/{id}"
	EpNotify  Endpoint = "/notify"
	EpPush    Endpoint = "/push/register"
	EpKnock   Endpoint = "/knock/{id}"
	EpHealth  Endpoint = "/healthz"
	EpRoot    Endpoint = "/"
	EpOther   Endpoint = "other" // anything unmatched; bounds cardinality
)

// allEndpoints is the closed set. Anything off it is EpOther, so the label space
// is fixed no matter what path arrives.
var allEndpoints = []Endpoint{
	EpAlias, EpAccount, EpNotify, EpPush, EpKnock, EpHealth, EpRoot, EpOther,
}

// methodsFor lists the request methods each endpoint is counted under, so the
// (endpoint, method) series exist at zero up front.
var methodsFor = map[Endpoint][]string{
	EpAlias:   {"GET", "PUT"},
	EpAccount: {"GET", "PUT"},
	EpNotify:  {"POST"},
	EpPush:    {"POST"},
	EpKnock:   {"POST"},
	EpHealth:  {"GET"},
	EpRoot:    {"GET"},
	EpOther:   {"GET", "PUT", "POST", "OTHER"},
}

// statusClasses is the bounded outcome label: 2xx / 4xx / 5xx. A concrete status
// is never a label (it would not add signal and 4xx/5xx is enough to alert on).
var statusClasses = []string{"2xx", "4xx", "5xx"}

// ErrorType is a small fixed enum for errors_total. It is a subsystem name, never
// an error message (which could embed a value).
type ErrorType string

const (
	ErrStore   ErrorType = "store"
	ErrEnqueue ErrorType = "enqueue"
	ErrJanitor ErrorType = "janitor"
	ErrDecode  ErrorType = "decode"
)

var allErrorTypes = []ErrorType{ErrStore, ErrEnqueue, ErrJanitor, ErrDecode}

// durationBuckets are deliberately COARSE (seconds). Fine buckets on the
// existence-uniform read /a/{id} would sharpen the already-tracked read-path
// timing gap (doc 10 §F); coarse buckets keep the histogram a health signal, not
// a sharper oracle. The histogram is never split by hit/miss or by id.
var durationBuckets = []float64{0.001, 0.005, 0.025, 0.1, 0.5, 2.5}

// Metrics is the registry plus the pre-registered instrument set the server uses.
type Metrics struct {
	reg *registry

	requests     map[seriesKey]*counter  // endpoint+method+class
	durations    map[Endpoint]*histogram // endpoint
	shed         map[Endpoint]*counter   // visible 503, by endpoint
	rateLimited  map[Endpoint]*counter   // visible 429, by endpoint
	sensitiveOOM map[Endpoint]*counter   // uniform-overload fallback, by endpoint
	errors       map[ErrorType]*counter  // by subsystem

	inflightCur *gauge
	inflightHi  *gauge
	inflightMax *gauge

	janitorLastRun *gauge // unix seconds of the last background-loop tick
}

type seriesKey struct {
	ep     Endpoint
	method string
	class  string
}

// New builds the registry and pre-registers every series at zero.
func New() *Metrics {
	r := newRegistry()
	m := &Metrics{
		reg:          r,
		requests:     map[seriesKey]*counter{},
		durations:    map[Endpoint]*histogram{},
		shed:         map[Endpoint]*counter{},
		rateLimited:  map[Endpoint]*counter{},
		sensitiveOOM: map[Endpoint]*counter{},
		errors:       map[ErrorType]*counter{},
	}

	const reqHelp = "Total HTTP requests by endpoint template, method, and status class."
	for _, ep := range allEndpoints {
		for _, meth := range methodsFor[ep] {
			for _, cls := range statusClasses {
				k := seriesKey{ep, meth, cls}
				m.requests[k] = r.counter("sti_requests_total", reqHelp,
					labels{"endpoint": string(ep), "method": meth, "status_class": cls})
			}
		}
		m.durations[ep] = r.histogram("sti_request_duration_seconds",
			"Request latency by endpoint template (coarse buckets).",
			durationBuckets, labels{"endpoint": string(ep)})
		m.shed[ep] = r.counter("sti_shed_total",
			"Visible 503 load-shed responses on non-sensitive endpoints, by endpoint.",
			labels{"endpoint": string(ep)})
		m.rateLimited[ep] = r.counter("sti_ratelimit_rejections_total",
			"Visible 429 rate-limit rejections, by endpoint.",
			labels{"endpoint": string(ep)})
		m.sensitiveOOM[ep] = r.counter("sti_sensitive_overload_total",
			"Uniform existence-blind overload fallbacks on sensitive reads, by endpoint.",
			labels{"endpoint": string(ep)})
	}
	for _, et := range allErrorTypes {
		m.errors[et] = r.counter("sti_errors_total",
			"Internal errors by subsystem (never a message or value).",
			labels{"type": string(et)})
	}

	m.inflightCur = r.gauge("sti_inflight_current", "In-flight requests right now.", nil)
	m.inflightHi = r.gauge("sti_inflight_highwater", "Peak in-flight requests since start.", nil)
	m.inflightMax = r.gauge("sti_inflight_max", "Configured MaxInflight concurrency cap.", nil)
	m.janitorLastRun = r.gauge("sti_janitor_last_run_seconds", "Unix time of the last background-loop tick (heartbeat).", nil)
	return m
}

// JanitorRan records that the background loop completed a tick at unixSeconds. A
// stalled loop shows up as this gauge going stale (now minus it grows without
// bound), which an alert can catch before knock_rows or the send queue back up.
func (m *Metrics) JanitorRan(unixSeconds int64) { m.janitorLastRun.Set(unixSeconds) }

// RegisterBuildInfo exposes which binary is running as a single sti_build_info{version}
// series valued 1. The version is a build identifier (e.g. a VCS revision), never
// anything about a subject.
func (m *Metrics) RegisterBuildInfo(version string) {
	m.reg.gauge("sti_build_info", "Running binary, labeled by build version (value is always 1).",
		labels{"version": version}).Set(1)
}

// RegisterRuntime wires Go runtime gauges (goroutines, heap, GC). They are pure
// process health, no subject data. MemStats is sampled once per scrape because
// runtime.ReadMemStats briefly stops the world.
func (m *Metrics) RegisterRuntime() {
	var (
		mu sync.Mutex
		ms runtime.MemStats
		at uint64
	)
	// field refreshes MemStats at most once per scrape and returns one field under
	// a single lock.
	field := func(scrapeID uint64, pick func(*runtime.MemStats) int64) int64 {
		mu.Lock()
		defer mu.Unlock()
		if scrapeID != at {
			runtime.ReadMemStats(&ms)
			at = scrapeID
		}
		return pick(&ms)
	}
	m.reg.gaugeFunc("sti_goroutines", "Current number of goroutines.", nil,
		func(uint64) int64 { return int64(runtime.NumGoroutine()) })
	m.reg.gaugeFunc("sti_memstats_heap_inuse_bytes", "Heap bytes in in-use spans.", nil,
		func(id uint64) int64 { return field(id, func(s *runtime.MemStats) int64 { return int64(s.HeapInuse) }) })
	m.reg.gaugeFunc("sti_memstats_heap_alloc_bytes", "Bytes of allocated heap objects.", nil,
		func(id uint64) int64 { return field(id, func(s *runtime.MemStats) int64 { return int64(s.HeapAlloc) }) })
	m.reg.gaugeFunc("sti_gc_cycles_total", "Completed GC cycles since start.", nil,
		func(id uint64) int64 { return field(id, func(s *runtime.MemStats) int64 { return int64(s.NumGC) }) })
}

// RegisterGaugeFunc wires a single unlabeled gauge sampled at scrape time. Used
// for host facts like free disk, computed by the caller (the metrics package does
// no filesystem or syscall work itself).
func (m *Metrics) RegisterGaugeFunc(name, help string, sample func() int64) {
	m.reg.gaugeFunc(name, help, nil, func(uint64) int64 { return sample() })
}

// endpointFor maps a request onto the closed Endpoint set using only the method
// and the leading path segment. It NEVER returns or stores the concrete id.
func endpointFor(method, path string) Endpoint {
	switch {
	case path == "/" || path == "":
		return EpRoot
	case path == "/healthz":
		return EpHealth
	case path == "/notify":
		return EpNotify
	case path == "/push/register":
		return EpPush
	case hasPrefix(path, "/a/"):
		return EpAlias
	case hasPrefix(path, "/acct/"):
		return EpAccount
	case hasPrefix(path, "/knock/"):
		return EpKnock
	default:
		return EpOther
	}
}

func hasPrefix(s, p string) bool { return len(s) >= len(p) && s[:len(p)] == p }

func methodLabel(ep Endpoint, method string) string {
	for _, m := range methodsFor[ep] {
		if m == method {
			return method
		}
	}
	return "OTHER"
}

func classOf(status int) string {
	switch {
	case status >= 500:
		return "5xx"
	case status >= 400:
		return "4xx"
	default:
		return "2xx"
	}
}

// Observe records a finished request: one requests_total increment and one
// latency sample. status==503 is additionally attributed to load-shed and
// status==429 to a rate-limit rejection, since on this server those statuses come
// only from those paths.
func (m *Metrics) Observe(method, path string, status int, seconds float64) {
	ep := endpointFor(method, path)
	meth := methodLabel(ep, method)
	if c := m.requests[seriesKey{ep, meth, classOf(status)}]; c != nil {
		c.Inc()
	}
	if h := m.durations[ep]; h != nil {
		h.Observe(seconds)
	}
	switch status {
	case http.StatusServiceUnavailable:
		if c := m.shed[ep]; c != nil {
			c.Inc()
		}
	case http.StatusTooManyRequests:
		if c := m.rateLimited[ep]; c != nil {
			c.Inc()
		}
	}
}

// SensitiveOverload records the never-visible uniform-overload fallback firing on
// a sensitive read (the response is a normal-looking decoy / fixed reply, so it
// cannot be inferred from status alone).
func (m *Metrics) SensitiveOverload(path string) {
	if c := m.sensitiveOOM[endpointFor("GET", path)]; c != nil {
		c.Inc()
	}
}

// Error increments the error counter for a subsystem. The caller passes a fixed
// type, never a message.
func (m *Metrics) Error(t ErrorType) {
	if c := m.errors[t]; c != nil {
		c.Inc()
	}
}

// IncInflight / DecInflight track concurrency and the running high-water mark.
func (m *Metrics) IncInflight() {
	cur := m.inflightCur.Add(1)
	m.inflightHi.SetMax(cur)
}
func (m *Metrics) DecInflight() { m.inflightCur.Add(-1) }

// SetInflightMax records the configured cap so a ratio alert can reference it.
func (m *Metrics) SetInflightMax(n int) { m.inflightMax.Set(int64(n)) }

// StatsGauge is a blind aggregate count sampled at scrape time.
type StatsGauge struct {
	DBSizeBytes               int64
	AliasRows                 int64
	AccountRows               int64
	KnockRows                 int64
	SendQueueDepth            int64
	SendQueueOldestAgeSeconds int64 // age of the oldest queued send, 0 if empty
}

// RegisterStats wires blind aggregate gauges that are sampled lazily when the
// endpoint is scraped (so a scrape, not every request, pays the small COUNTs). If
// sample returns an error the previous values are kept.
func (m *Metrics) RegisterStats(sample func(context.Context) (StatsGauge, error)) {
	defs := []struct {
		name, help string
		pick       func(StatsGauge) int64
	}{
		{"sti_db_size_bytes", "Logical SQLite database size in bytes.", func(s StatsGauge) int64 { return s.DBSizeBytes }},
		{"sti_alias_rows", "Distinct alias ciphertext rows (blind count).", func(s StatsGauge) int64 { return s.AliasRows }},
		{"sti_account_rows", "Distinct account-sync ciphertext rows (blind count).", func(s StatsGauge) int64 { return s.AccountRows }},
		{"sti_knock_rows", "Live knock rows (auto-expiring, blind count).", func(s StatsGauge) int64 { return s.KnockRows }},
		{"sti_send_queue_depth", "Wake jobs awaiting drain.", func(s StatsGauge) int64 { return s.SendQueueDepth }},
		{"sti_send_queue_oldest_age_seconds", "Age of the oldest queued send in seconds (0 if empty); a stuck queue grows this.", func(s StatsGauge) int64 { return s.SendQueueOldestAgeSeconds }},
	}
	// Memoize one sample per scrape: the first gaugeFunc invoked refreshes the
	// shared snapshot, the rest read it. scrapeID increments per render pass.
	var (
		mu       sync.Mutex
		cached   StatsGauge
		cachedAt uint64
	)
	for _, d := range defs {
		pick := d.pick
		m.reg.gaugeFunc(d.name, d.help, nil, func(scrapeID uint64) int64 {
			mu.Lock()
			defer mu.Unlock()
			if scrapeID != cachedAt {
				ctx, cancel := context.WithTimeout(context.Background(), 2_000*1e6) // 2s
				defer cancel()
				if s, err := sample(ctx); err == nil {
					cached = s
				}
				cachedAt = scrapeID
			}
			return pick(cached)
		})
	}
}

// Handler exposes the registry in Prometheus text format. Bind it on a loopback
// listener only; it must never be public (doc 12 §5).
func (m *Metrics) Handler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		m.reg.render(w)
	})
}

// --- registry primitives ----------------------------------------------------

type labels map[string]string

type counter struct{ v atomic.Int64 }

func (c *counter) Inc()       { c.v.Add(1) }
func (c *counter) get() int64 { return c.v.Load() }

// gauge holds a signed integer value (bytes or counts). Add returns the new value
// so concurrency tracking needs no second load.
type gauge struct{ v atomic.Int64 }

func (g *gauge) Set(n int64)       { g.v.Store(n) }
func (g *gauge) Add(n int64) int64 { return g.v.Add(n) }
func (g *gauge) get() int64        { return g.v.Load() }
func (g *gauge) SetMax(n int64) {
	for {
		old := g.v.Load()
		if n <= old || g.v.CompareAndSwap(old, n) {
			return
		}
	}
}

type histogram struct {
	bounds  []float64
	counts  []atomic.Int64 // per-bucket (non-cumulative); last is +Inf
	sumBits atomic.Uint64  // float64 bits of the running sum
	count   atomic.Int64
}

func newHistogram(bounds []float64) *histogram {
	return &histogram{bounds: bounds, counts: make([]atomic.Int64, len(bounds)+1)}
}

func (h *histogram) Observe(v float64) {
	// "le" (less-than-or-equal) bucket: the first bound where v <= bound, else the
	// final +Inf bucket. Bounds are short and sorted, so a linear scan is cheap.
	idx := len(h.bounds)
	for j, b := range h.bounds {
		if v <= b {
			idx = j
			break
		}
	}
	h.counts[idx].Add(1)
	h.count.Add(1)
	for {
		old := h.sumBits.Load()
		nw := math.Float64bits(math.Float64frombits(old) + v)
		if h.sumBits.CompareAndSwap(old, nw) {
			break
		}
	}
}

// metric is one named series with its labels and a value source.
type metricKind int

const (
	kindCounter metricKind = iota
	kindGauge
	kindGaugeFunc
	kindHistogram
)

type metric struct {
	name string
	help string
	kind metricKind
	lbls labels

	c  *counter
	g  *gauge
	gf func(scrapeID uint64) int64
	h  *histogram
}

type registry struct {
	mu      sync.Mutex
	metrics []*metric
	scrapes atomic.Uint64
}

func newRegistry() *registry { return &registry{} }

func (r *registry) counter(name, help string, l labels) *counter {
	c := &counter{}
	r.add(&metric{name: name, help: help, kind: kindCounter, lbls: l, c: c})
	return c
}

func (r *registry) gauge(name, help string, l labels) *gauge {
	g := &gauge{}
	r.add(&metric{name: name, help: help, kind: kindGauge, lbls: l, g: g})
	return g
}

func (r *registry) gaugeFunc(name, help string, l labels, fn func(scrapeID uint64) int64) {
	r.add(&metric{name: name, help: help, kind: kindGaugeFunc, lbls: l, gf: fn})
}

func (r *registry) histogram(name, help string, bounds []float64, l labels) *histogram {
	h := newHistogram(bounds)
	r.add(&metric{name: name, help: help, kind: kindHistogram, lbls: l, h: h})
	return h
}

func (r *registry) add(m *metric) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.metrics = append(r.metrics, m)
}

// render writes every series in Prometheus text format, emitting one HELP/TYPE
// header per distinct metric name (in first-seen order).
func (r *registry) render(w io.Writer) {
	r.mu.Lock()
	defer r.mu.Unlock()
	scrapeID := r.scrapes.Add(1)

	seenHeader := map[string]bool{}
	bw := &errWriter{w: w}
	for _, m := range r.metrics {
		if !seenHeader[m.name] {
			seenHeader[m.name] = true
			bw.writeString("# HELP " + m.name + " " + m.help + "\n")
			bw.writeString("# TYPE " + m.name + " " + typeName(m.kind) + "\n")
		}
		switch m.kind {
		case kindCounter:
			bw.writeString(m.name + renderLabels(m.lbls, "") + " " + strconv.FormatInt(m.c.get(), 10) + "\n")
		case kindGauge:
			bw.writeString(m.name + renderLabels(m.lbls, "") + " " + strconv.FormatInt(m.g.get(), 10) + "\n")
		case kindGaugeFunc:
			bw.writeString(m.name + renderLabels(m.lbls, "") + " " + strconv.FormatInt(m.gf(scrapeID), 10) + "\n")
		case kindHistogram:
			writeHistogram(bw, m)
		}
	}
}

func writeHistogram(bw *errWriter, m *metric) {
	var cumulative int64
	for i, b := range m.h.bounds {
		cumulative += m.h.counts[i].Load()
		bw.writeString(m.name + "_bucket" + renderLabels(m.lbls, "le=\""+formatFloat(b)+"\"") + " " +
			strconv.FormatInt(cumulative, 10) + "\n")
	}
	cumulative += m.h.counts[len(m.h.bounds)].Load()
	bw.writeString(m.name + "_bucket" + renderLabels(m.lbls, "le=\"+Inf\"") + " " +
		strconv.FormatInt(cumulative, 10) + "\n")
	sum := math.Float64frombits(m.h.sumBits.Load())
	bw.writeString(m.name + "_sum" + renderLabels(m.lbls, "") + " " + formatFloat(sum) + "\n")
	bw.writeString(m.name + "_count" + renderLabels(m.lbls, "") + " " +
		strconv.FormatInt(m.h.count.Load(), 10) + "\n")
}

func typeName(k metricKind) string {
	switch k {
	case kindHistogram:
		return "histogram"
	case kindCounter:
		return "counter"
	default:
		return "gauge"
	}
}

// renderLabels emits a sorted, deterministic label set, optionally appending one
// extra label (used for the histogram "le"). Empty labels render as no braces.
func renderLabels(l labels, extra string) string {
	keys := make([]string, 0, len(l))
	for k := range l {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys)+1)
	for _, k := range keys {
		parts = append(parts, k+"=\""+l[k]+"\"")
	}
	if extra != "" {
		parts = append(parts, extra)
	}
	if len(parts) == 0 {
		return ""
	}
	out := "{"
	for i, p := range parts {
		if i > 0 {
			out += ","
		}
		out += p
	}
	return out + "}"
}

func formatFloat(f float64) string { return strconv.FormatFloat(f, 'g', -1, 64) }

type errWriter struct {
	w   io.Writer
	err error
}

func (e *errWriter) writeString(s string) {
	if e.err != nil {
		return
	}
	_, e.err = io.WriteString(e.w, s)
}

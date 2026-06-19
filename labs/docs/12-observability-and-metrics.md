# sti.care: Observability & Metrics

_New, June 19, 2026._

*The "how do we run it without seeing it." How we watch the blind backend for health, capacity, and
errors without ever learning a status, a graph, or an identity. Pairs with
[Build, Backend & Deployment](10-build-backend-and-deployment.md) (what the server is and how it
sheds), [Frontend to Backend Integration](11-frontend-backend-integration.md) (the seam that
generates the traffic), [Data & storage](/docs/data) (what lives where and what we provably cannot
see), and the [Decisions log](/docs/decisions) (the locked choices this must honor). Not legal
advice.*

---

## The one rule everything here obeys

**Telemetry about the SYSTEM, never about the SUBJECT.** We measure the machine (requests, latency,
shed, queue depth, errors), never the person, the device, or the card. The bar for every metric and
every log line in this doc is a single test:

> Even someone holding **all** of our telemetry at once cannot attribute a value to a person, a
> device, or a card.

If a proposed signal cannot clear that bar, it does not ship. It is written down in
[Explicitly rejected](#explicitly-rejected-and-why) with the reason, so the "no" is auditable rather
than implicit. This rule is downstream of the locked promise in [Data & storage](/docs/data): the
server stores ciphertext and opaque tokens, nothing else, and cannot see your status, graph, or
identity. Observability must keep that promise **literally true**, not "true except for the metrics."

Two corollaries used throughout:

- **No new eyes.** Observability adds no third-party data processor that the blind story does not
  already account for. We lean first on infrastructure that is already inside the trust boundary
  (the Cloudflare edge that already terminates TLS for `api.sti.care`) and on aggregate counters the
  origin computes for itself. We do not hand request data to a SaaS we do not control.
- **No event trail.** We keep counts and distributions, never a per-request record. There is no row
  anywhere that says "a request for this id arrived at this time from here." The absence of that row
  is a feature, and this doc's job is to keep it absent.

---

## 1. Goals, separated by purpose

These are deliberately split, because they carry very different privacy risk. The first three are
low-risk system facts. The fourth is the dangerous one and gets its own section.

- **Operational debugging.** When something is wrong, answer "what, and roughly where" from aggregate
  signal: which endpoint class is erroring, whether the box is saturated, whether the database is
  growing abnormally, whether the janitor is running. The aim is to localize a fault to a subsystem,
  never to reconstruct a single user's session.
- **Capacity planning and alerting.** Know when the flat-rate box is approaching its ceiling before
  it degrades, so we can resize the VPS deliberately rather than discover it through gray passports.
  The whole deploy posture is "degrade, never surprise-bill" ([Build & Deployment](10-build-backend-and-deployment.md)
  §D), and capacity telemetry is what tells us when a deliberate resize is due. This is the **first
  concrete deliverable** (section 3).
- **Error detection.** Notice that errors are happening and what *type* they are (a store error, a
  decode error, a janitor failure), so a regression surfaces in minutes rather than via a user
  report. Type and rate only, never the offending value.
- **Product and usage understanding.** Understand, coarsely, whether the thing is used and growing.
  This is the riskiest goal by far, because "usage" is exactly the dimension an attacker wants to map
  back to people. It is quarantined in section 6 and treated as guilty until proven harmless.

---

## 2. The blind-telemetry principle

Stated once, as the rule the rest of the doc is just an application of:

**LOCKED (this doc): every metric, label, and log line is a property of the system in aggregate, with
bounded cardinality and no identifying field.** Concretely, no metric or log may carry, as a value or
as a label:

- an alias id, account id, routing endpoint id, or any path containing one;
- a client IP (the origin never sees the real one anyway; see section 4);
- a request or response body, or any fragment of ciphertext or plaintext;
- a write token, requester hash, notify token-hash, or any other secret or token;
- a per-request identifier, sequence number, or anything that links two requests to each other or to
  a subject;
- a free-form, high-cardinality string (a raw error message, a user agent, a full URL).

Everything that follows either satisfies this or is rejected. When the existence-uniform endpoints
(`GET /a/{id}` and `POST /knock/{id}`) are involved, the principle tightens further: a metric may not
encode anything that distinguishes a hit from a miss, because that is an existence oracle in
aggregate form (section 9).

---

## 3. What we collect (the safe aggregate set)

All origin metrics below are **counters, gauges, and histograms** held in process and exposed on a
loopback-only scrape endpoint (section 5). Every label space is small and fixed. The endpoint label
is always the **route template** (`/a/{id}`, `/acct/{id}`, `/knock/{id}`, `/notify`,
`/push/register`, `/healthz`, `/`), **never** the concrete path, so an id can never become a label
value. That single discipline is the difference between safe and catastrophic, so it is called out
again in the audit.

### 3a. Capacity alerting: the first deliverable

This ships first because it is the highest value for the lowest risk: it is pure system load, it
contains nothing about any subject, and it is what protects the degrade-not-bill posture. Proposed
signals and thresholds:

| Signal | Source | Warn | Page | Why |
| --- | --- | --- | --- | --- |
| Visible shed rate (`429`/`503` on non-sensitive endpoints) | `shed_total`, `ratelimit_rejections_total` | any sustained `> 0` over 5 min | `> N`/sec over 1 min | A non-zero shed rate means real users are being turned away; the box needs a deliberate resize. |
| Uniform-overload events on sensitive reads | `sensitive_overload_total` (count of the `SensitiveWait` timeout path firing) | any `> 0` over 5 min | rising over 1 min | `GET /a` and `POST /knock` never shed *visibly*; instead they fall back to the uniform decoy/fixed reply under saturation. That fallback is invisible to users by design, so it needs its own alert or saturation hides. |
| Inflight high-water vs `MaxInflight` | `inflight_highwater` / `inflight_max` (default 256) | `> 80%` over 1 min | `> 95%` over 1 min | The concurrency cap is the real ceiling. Approaching it predicts shedding before it starts. |
| `GET /a` p99 latency | `request_duration_seconds{endpoint="/a/{id}"}` | `> 50ms` | `> 200ms` | The hot read is a single indexed SQLite lookup; a rising p99 means disk, lock, or saturation pressure. Numbers are placeholders until a benchmark sets the baseline (see note). |

These thresholds are **starting proposals, not asserted facts.** Per the repo's "no perf claim
without a test" rule ([Build & Deployment](10-build-backend-and-deployment.md) §C), the p99 numbers
are placeholders until the load benchmark establishes a real baseline on the chosen box; the alert
then fires on deviation from that measured baseline, not from a guessed constant. The shed and
inflight thresholds are structural (they reference `MaxInflight`, which is known) and can land
immediately.

### 3b. The full safe set

| Metric | Type | Labels (all bounded) | Purpose |
| --- | --- | --- | --- |
| `requests_total` | counter | `endpoint` (route template), `status_class` (`2xx`/`4xx`/`5xx`) | Request rate by endpoint and outcome class. |
| `request_duration_seconds` | histogram | `endpoint` | Latency distribution per endpoint (coarse buckets; see audit). |
| `shed_total` | counter | `endpoint` | Visible `503` load-shed on non-sensitive endpoints. |
| `ratelimit_rejections_total` | counter | `endpoint` | Visible `429` from the per-IP limiter (non-sensitive endpoints). |
| `sensitive_overload_total` | counter | `endpoint` (`/a/{id}` or `/knock/{id}`) | The never-visible uniform-overload fallback firing under saturation. |
| `inflight_current` | gauge | none | Live in-flight count (0..`MaxInflight`). |
| `inflight_highwater` | gauge | none | Peak in-flight since last scrape. |
| `inflight_max` | gauge | none | The configured `MaxInflight`, for ratio alerts. |
| `db_size_bytes` | gauge | none | SQLite file size; growth and anomaly watch. |
| `send_queue_depth` | gauge | none | Rows in `send_queue` awaiting drain (push wake backlog). |
| `knock_rows` | gauge | none | Rows in the `knock` table (capacity of the auto-expiring store). |
| `errors_total` | counter | `type` (small fixed enum: `store`, `decode`, `enqueue`, `janitor`) | Error rate by subsystem, never by value. |
| `build_info` | gauge (value 1) | `version` | Which binary is running; one series. |

Every one of these is a count or distribution. None names an id, an IP, a body, or a token. None can
be filtered down to a single subject, because there is no per-subject dimension to filter on. Edge
volume, geography, threat, and cache stats come from Cloudflare for free (section 5) and are not
re-collected here.

---

## 4. What we provably do not collect

This is the load-bearing list. It is stated as hard prohibitions, several of which are already true
of the deployed system and must stay true.

**We do not collect, anywhere (origin metrics, origin logs, or edge):**

- **Ids.** No alias id, account id, or routing endpoint id, as a value, a label, a log field, or a
  substring of a path. The origin already does not log them; this forbids re-introducing them.
- **Client IPs.** The origin **cannot** see the real client IP: Caddy rewrites `X-Real-IP` to the
  Cloudflare edge address and strips `X-Forwarded-For` and `CF-Connecting-IP`
  (`server/deploy/Caddyfile`). Per-client rate limiting lives at the edge precisely so the blind
  origin never holds a client address. **No metric or log may re-introduce a client IP**, and no code
  may start trusting `X-Forwarded-For` / `CF-Connecting-IP` to recover one.
- **Request or response bodies.** No ciphertext, no decoy bytes, no JSON payload, no headers carrying
  tokens.
- **Tokens and hashes.** No `X-Write-Token`, no `requester_hash`, no notify `token_hash`. These are
  the keys to routing and writing; they never enter telemetry.
- **A per-request event trail.** No access log, no per-request row, nothing timestamped per request
  at the granularity that would let two requests be correlated or a single id's traffic be
  reconstructed. We keep aggregates, not events.
- **Anything linking requests to a subject or to each other.** No session id, no correlation id, no
  device fingerprint, no cookie.

**Logging rules for the origin (`slog`), stated as code-review-enforceable invariants:**

1. `slog` stays at `Info` level in production. No `Debug` path may log payloads, ids, or headers.
2. A log line may carry: a static message, a numeric count (e.g. `purged expired knocks count=N`),
   an `err` value, an `addr`/`db` config string at startup. Nothing else.
3. **An `err` value logged with `slog.Error` must not embed an id, token, IP, or body.** Today
   `alias get`, `enqueue send`, and `record knock` log only the wrapped error, which is safe; this
   rule keeps it safe by forbidding store errors from interpolating the id or token into the error
   string. This is checkable with a test that fails if an error path formats an id into its message.
4. **No origin access log.** The Go server writes no per-request log, and Caddy has **no `log`
   directive** (`server/deploy/Caddyfile`), so there is no edge access log either. If a Caddy access
   log is ever turned on for debugging, it must omit the URI (it contains ids) and the client address,
   and it must be off by default. Preferred: never turn it on; use aggregate counters instead.
5. No metric label is ever derived from a path segment, a header value, or a body field.

These are not aspirations. Items 1 to 4 describe the system as it ships today; this doc's
contribution is to pin them so a future change cannot quietly erode them.

---

## 5. Where telemetry lives

In priority order. The cheapest and safest source is first, and we only descend when it cannot answer
the question.

1. **Cloudflare edge analytics (first choice).** Cloudflare already fronts `api.sti.care` and already
   terminates TLS as the edge, so it is already inside the trust boundary the data doc discloses. Its
   analytics give aggregate request volume, status-code breakdown, country-level geography, cache
   HIT/MISS ratios, and firewall/threat events **with zero origin instrumentation and zero data we
   store ourselves.** This is strictly preferred for anything it can answer (traffic shape, attack
   volume, edge cache behavior), because it adds no new processor and no new store under our control.
   The granularity caveat is in the audit (section 9): we do not drill edge analytics down to a slice
   that could isolate a single early user.
2. **Origin aggregate counters (loopback only).** The metrics in section 3, exposed by the Go binary
   as a Prometheus-style text endpoint on a **separate listener bound to `127.0.0.1` only**, not added
   to the public mux and **not** proxied by Caddy. It is therefore unreachable from the internet:
   never public, behind the existing Cloudflare-only firewall, mTLS, and `ufw` controls, and addressed
   only from the box itself by a local scraper. It exposes counts and distributions, never a per-request
   record. If a remote dashboard is ever wanted, it is reached over an SSH tunnel or a private network,
   never by opening the port.
3. **Optional self-hosted, scrubbed client error channel.** Client-side JavaScript errors are useful
   for catching crypto or rendering regressions in the passport app, but the browser is where
   plaintext lives, so this is the riskiest channel and is **optional and off until it earns its
   place** (open question, section 10). If built, it must be: **self-hosted** on our own origin (no
   third party); **scrubbed before storage** (strip any id from URLs and stack frames, never capture
   request/response bodies, IndexedDB contents, keys, or breadcrumb values; allowlist a small set of
   fields rather than denylisting); **aggregate-leaning** (error type and count over raw stacks where
   possible); and **rate-limited**. If we cannot guarantee the scrub, we do not ship the channel and
   stay on logs plus edge analytics.

**REJECTED: any third-party SaaS telemetry processor.** No Sentry cloud, no Datadog RUM, no Google
Analytics, no hosted APM. Each would become a **new data processor** that receives request metadata,
stack traces, or behavioral events directly, which undercuts the "the server stores ciphertext and
opaque tokens, nothing else" promise the moment a stack trace or a URL with an id reaches their
servers. SaaS error tools also capture rich context (URLs, headers, local variables, breadcrumbs) **by
default**, which is exactly the data we forbid. If error reporting is wanted, it is the self-hosted,
scrubbed channel above, or nothing.

---

## 6. Product and usage metrics (the dangerous case)

Treated as guilty until proven harmless. The order of preference is strict.

**First, derive product signal from blind aggregates we already hold.** Several useful product
questions can be answered with zero new collection, because a count of opaque rows names no one:

- **Rough active/registered proxy:** the count of distinct account blobs (`account` table rows) is a
  coarse "how many devices sync with us" number. It is a row count of opaque, key-derived ids; it
  names no person and reveals no status.
- **Rough reach proxy:** the count of distinct alias rows is a coarse "how many passports exist"
  number, with the same non-identifying property.
- **Liveness:** request-rate trends from section 3 already show whether the system is used and
  growing.

These are gauges in the safe set; they are the **preferred** usage signal precisely because they
cannot be attributed to anyone.

**Anything beyond a blind row count must clear every one of these gates, or it does not ship:**

- **Client-side.** Computed in the app, not by watching server traffic (server-side behavioral
  tracking is how you accidentally build the event trail section 4 forbids).
- **Aggregate and identifier-free.** No device id, user id, cookie, or fingerprint. Counts of events,
  not streams of events.
- **Disclosed.** Named in [Data & storage](/docs/data) and visible to the user, not silent.
- **Ideally opt-in, and off by default.** The default state collects nothing; a user turns it on.
- **Gated behind a k-anonymity floor.** No cohort, bucket, or breakdown is reported unless it
  contains at least **K = 50** distinct contributors, and **nothing is reported at all until the total
  contributing population exceeds 500** (ten times the floor, so a reported bucket cannot be isolated
  by differencing against the total). A bucket under the floor is suppressed entirely, not rounded or
  bucketed-up. The product already uses a min-group-size of 5 to protect *group-status viewing*
  ([Decisions log](/docs/decisions)); analytics buckets get a **higher** floor than that, because
  analytics cohorts intersect and can be differenced against each other in ways a single group-view
  cannot. The exact floor is flagged for sign-off (section 10); 50/500 is the proposed starting point,
  not a unilateral decision.

In practice, for the MVP population this means: report the global blind row counts, and **defer all
finer usage analytics until the population comfortably clears the floor across every bucket we would
report.** Recommendation: ship section 6's blind proxies only, and hold the opt-in client analytics
until there is both a population that clears the floor and a signed-off floor.

---

## 7. Retention

Short, aggregate-only, with no raw event store anywhere.

- **Edge analytics:** retained by Cloudflare on the free plan (roughly recent-window granular,
  longer-window aggregated). We add nothing to it and store none of it ourselves; we read it live.
- **Origin counters:** live in process and **reset on restart**. If we ever persist them for trend
  history, we persist **rolled-up aggregates only** (for example hourly summaries kept ~30 days),
  never per-request rows. The rollup is counts and histogram buckets, nothing addressable.
- **Client error channel (if built):** scrubbed aggregates kept a **short window (~14 to 30 days)**
  then dropped or collapsed to type-counts. No indefinite raw-stack archive.
- **Usage analytics (if ever built):** only floor-passing aggregates are stored, on the same short
  window; the underlying per-event stream is never persisted.

The invariant across all four: **no raw event store, ever.** Retention windows are confirmable values
for sign-off (section 10), not asserted here as final.

---

## 8. Trust-doc reflection (the exact change to 09)

Adding telemetry changes the honest answer to "what can you see," so
[Data & storage](/docs/data) must be updated in the same change that ships any of this, or the doc
goes stale and the promise quietly stops being true. The proposed edit to the
**"What we can and can't see"** section:

Replace the current "We can see" line:

> **We can see:** that an alias or a push endpoint exists, that some tokens got pinged, and the size
> of a ciphertext. That's the list.

with:

> **We can see:** that an alias or a push endpoint exists, that some tokens got pinged, the size of a
> ciphertext, and **aggregate operational telemetry about the service itself** (request rates and
> latencies per endpoint, error and shed counts, queue depth, total row counts). The telemetry is
> system-level only: it carries no id, IP, request body, or token, no per-request trail, and nothing
> that links a request to a person or to another request. That's the list.

The **"We can't see"** line stays exactly as written (graph, group membership, diagnoses, dates,
contact counts) because none of those become visible, and the **one-line promise** at the top of 09
("ciphertext and opaque routing tokens, nothing else") stays accurate: aggregate counts about the
system are not "something else we store about you," they are facts about the machine. If any future
metric would force a change to the "We can't see" line, that metric does not ship.

---

## 9. Adversarial self-audit

For each proposed signal: how could it leak, correlate, or act as a timing/existence oracle, and how
could an outside attacker or a **compromised-but-honest operator** (someone with full read of every
metric, loopback gauge, and log, but who follows the rules) abuse it? Anything that fails moves to
[Explicitly rejected](#explicitly-rejected-and-why).

- **`endpoint` label.** The whole scheme stands or falls on this label being the route **template**.
  If it were ever the concrete path, `/a/{id}` would put live alias ids straight into the metric
  store, which is the worst possible leak. **Mitigation:** the label is the fixed template string from
  the router, never `r.URL.Path`; a test asserts no metric series contains an id-shaped segment. Pass,
  with that test as a hard gate.
- **`requests_total{status_class}` on `/a` and `/knock`.** Could a status break existence
  uniformity? No: `GET /a` returns `200` for both a real hit and a decoy miss, and `POST /knock`
  returns `200` for every id. So `status_class` on these two is constant across hit and miss and
  reveals nothing about existence. It would only become an oracle if we split the metric by hit vs
  miss, which we explicitly do not (rejected below). Pass.
- **`request_duration_seconds{endpoint="/a/{id}"}`.** The read-path timing gap (a real DB hit vs the
  decoy HMAC) is a **carried open item** ([Build & Deployment](10-build-backend-and-deployment.md)
  §F), independent of metrics. Does an aggregate latency histogram make it worse? An attacker timing a
  single request does not need our internal metrics to do so, and an aggregate p99 over all `/a`
  traffic does not attribute latency to any one id. **Mitigation:** keep `/a` histogram buckets
  **coarse**, and **never** split the histogram by hit/miss, by id, or by cache status. With those
  constraints the histogram is a system-health signal, not a new oracle. Pass, with the coarse-bucket
  and no-split constraints.
- **The deferred short edge cache on `/a`.** Doc 10 keeps `/a` **uncached** in v1 precisely because
  per-id cache state (HIT vs MISS) is an existence oracle, and only allows a short cache later under
  strict conditions ([Build & Deployment](10-build-backend-and-deployment.md) §C). For telemetry: an
  **aggregate** edge cache hit-rate (a single ratio over all `/a` traffic) attributes to no one and is
  fine, but **per-id cache status must never be exposed or queried**, and we must not add an origin
  metric that distinguishes a cache-served read from an origin-served one per id. The risk lives in
  the cache existing at all (deferred in doc 10), not in the aggregate ratio. Pass for the aggregate
  ratio; per-id cache status rejected below.
- **`sensitive_overload_total`.** A count of the uniform-overload fallback firing. It is a saturation
  signal with no id and no hit/miss split (the fallback returns the same decoy/fixed reply regardless
  of existence), so it cannot reveal whether any specific id exists. Pass.
- **`knock_rows` and `send_queue_depth`.** Aggregate gauges. At a **very small population**, a
  compromised-but-honest operator watching `knock_rows` tick up could infer "a knock happened around
  time T", and watching `send_queue_depth` could infer "a wake was enqueued around time T." Neither
  can be attributed to a person, an id, or a pair (the gauge is a single number with no key), so it
  fails to name a subject. It is the same class of information as "the service is being used right
  now." **Residual:** at single-digit N it is a coarse activity timeline. Flagged for sign-off
  (whether to coarsen or withhold small-N gauges). Pass on the attribution bar; small-N timeline noted.
- **`db_size_bytes`.** Grows when any alias, account, or knock is written. A small-N operator could
  read it as "something was written around time T." Same verdict as above: it names a write, never a
  writer. Pass on the bar; same small-N caveat.
- **`errors_total{type}` and the `slog` error lines.** Safe only as long as `type` is a fixed enum and
  the `err` value carries no id/token/body. The failure mode is a store error that interpolates the
  offending id into its message and then gets logged. **Mitigation:** the logging rules in section 4
  plus a test that fails if an error path formats an id/token into its string. Pass, conditional on
  that test.
- **Cloudflare geography / ASN analytics.** Country-level volume is aggregate and safe at scale, but
  at a small early population a single-user country (or a narrow ASN) is **near-identifying**: "one
  request from country X" can finger one person, and Cloudflare can already infer this as the edge.
  **Mitigation:** do not drill edge analytics to a granularity that isolates a single user (no
  per-country views while a country has one plausible user), and restrict who may view edge analytics.
  Flagged for sign-off. Conditional pass.
- **The optional client error channel.** Highest risk: the browser holds plaintext, so a thrown error
  can embed a decrypted value, an id from a URL, or a key handle, and a SaaS tool would capture all of
  it by default. **Mitigation:** self-hosted only, strict allowlist scrub (no bodies, no URLs with
  ids, no IndexedDB, no keys), aggregate-leaning, rate-limited; if the scrub cannot be guaranteed, do
  not ship it. Conditional pass, and gated behind the section 10 sign-off.
- **Compromised-but-honest operator, end to end.** Holding every counter, gauge, histogram, and log
  line at once, this operator sees: how much traffic, how fast, how many errors, how big the database,
  how deep the queue. Every one of those is a system fact. They never see an id, an IP, a body, a
  hit/miss split, or any key to join two observations into a subject. They cannot name a person, a
  device, or a card. The design holds against this threat **only because** the rejected items below
  stay rejected; they are what would hand this operator a join key.

### Explicitly rejected (and why)

- **Alias hit/miss counter** (`alias_hits_total` vs `alias_misses_total`, or any per-id hit metric).
  An aggregate existence oracle, and a latency/existence join key. Breaks the locked uniformity of
  `GET /a`. Rejected.
- **Knock recorded-vs-received split** (a counter that increments only when a knock is actually
  recorded vs all `POST /knock`). The difference leaks the aggregate rate of valid/extant ids, an
  existence oracle. Only a single total `POST /knock` count (uniform across all ids) is allowed.
  Rejected.
- **Notify found/miss counter** (whether a `token_hash` resolved to a route). A recipient-existence
  oracle, adjacent to the already-disclosed targeted-push caveat. Rejected.
- **Any metric or label carrying a concrete id, a path-with-id, an IP, a token, a hash, a requester,
  or a notify token.** The core prohibition; restated as a rejection so it is searchable. Rejected.
- **Per-request access log (origin or Caddy) with path + timestamp.** Reconstructs the event trail and
  enables request-to-request correlation. Rejected; aggregate counters replace it.
- **Per-id edge cache status metric.** A cache-state existence oracle (the exact reason `/a` is
  uncached in v1). Only the aggregate hit-rate ratio is allowed. Rejected.
- **User-agent or fine-grained geo/ASN labels on origin metrics.** High cardinality and
  near-identifying at small N. Rejected; edge geography stays at a coarse, non-isolating grain.
- **Third-party SaaS telemetry/APM/RUM (Sentry cloud, Datadog, GA, etc.).** A new data processor that
  undercuts the blind story and captures forbidden context by default. Rejected; self-hosted scrubbed
  channel or nothing.
- **Client-side analytics keyed by a stable device or user id** (any cookie, fingerprint, or persistent
  analytics id). Builds the exact subject linkage the whole design forbids. Rejected; usage analytics,
  if any, are identifier-free and floor-gated.

---

## 10. Open questions for human sign-off

These need a privacy/product judgment call and are **not** decided here.

1. **The k-anonymity floor.** Is `K = 50` per bucket with a `500`-population report threshold the
   right floor for usage analytics, and is "higher than the existing min-group-size of 5" the right
   relationship? Owner of the privacy claim signs the number.
2. **Whether to ship the client error channel at all for MVP.** Given the residual scrub risk in a
   plaintext-holding browser, do we build the self-hosted scrubbed channel, or stay logs-plus-edge
   only until there is a concrete need? Recommendation: defer.
3. **Cloudflare analytics granularity and access policy.** Do we forbid country/ASN drill-downs that
   could isolate a single early user, and who is allowed to view edge analytics? Needs a stated policy.
4. **Small-N aggregate gauges.** Should `db_size_bytes`, `knock_rows`, and `send_queue_depth` be
   coarsened or withheld until the population exceeds a threshold, to deny a compromised-but-honest
   operator a fine-grained activity timeline? They pass the attribution bar but are a coarse
   liveness timeline at single-digit N.
5. **Whether any usage analytics ship for MVP at all.** Recommendation: ship only the blind row-count
   proxies (section 6) and defer all opt-in client analytics until both the floor is signed off and
   the population clears it.
6. **Exact retention windows.** Confirm the origin-rollup window (~30 days proposed), the error-channel
   window (~14 to 30 days proposed), and reliance on Cloudflare's default edge retention.
7. **Disclosure surface and default for opt-in usage telemetry.** Where it is disclosed (the data doc
   and an in-app toggle) and that the default is off. Recommendation: disclosed in
   [Data & storage](/docs/data), off by default.

---

Mechanics of the server and its shed/uniformity guarantees live in
[Build, Backend & Deployment](10-build-backend-and-deployment.md); what lives where and the
can/can't-see promise this doc must preserve live in [Data & storage](/docs/data).

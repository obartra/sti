# sti.care: Load & Usage Testing

*The "drive it like real users before there are any." How we model the interactions the app
actually produces, generate realistic traffic and deliberate overload against a throwaway instance,
and catch usage bugs (and capacity ceilings) while the data is synthetic and disposable. Pairs with
[Build, Backend & Deployment](10-build-backend-and-deployment.md) (what the server is and how it
sheds), [Frontend to Backend Integration](11-frontend-backend-integration.md) (the seam that
generates the traffic), [Observability & Metrics](12-observability-and-metrics.md) (the blind
aggregate signal we read while it runs), and the [Decisions log](/docs/decisions) (the locked
choices this must honor). Not legal advice.*

---

## The one thing this is, and the one thing it is not

This is a **lab**: a single orchestrated run that stands up a disposable copy of the system, plays a
realistic mix of user interactions through it (and then more than realistic, on purpose), checks
that the system behaves and degrades the way it is designed to, collects the evidence for every
check it makes, and then **destroys everything it created**. Its purpose is to find behavior and
capacity bugs *before there are real users to find them for us*.

It is **not production telemetry, and it is not a client-error channel**. [Observability &
Metrics](12-observability-and-metrics.md) §5 rejects, outright and permanently, any stream of client
errors out of the shipped app, because the browser holds plaintext. Nothing in this doc relaxes that
line. The lab catches console errors by **observing a browser we drive against a throwaway instance,
with synthetic data we generated and will delete**, never by collecting anything from a real user's
device. The reconciliation is spelled out in the self-audit (section 9); it is load-bearing, so it
is stated up front: catching errors *in a test we run* is the opposite of collecting errors *from a
person we serve*.

---

## 1. What the lab answers

Four questions, in priority order. The first two are correctness, the second two are capacity.

- **Does the real interaction mix work under concurrency?** Not "does one request succeed" (the
  integration tests already prove that), but "do thousands of interleaved publishes, reads, knocks,
  and syncs from many simulated users still produce correct results, with no lost writes, no leaked
  existence, and no uncaught client error." Concurrency bugs hide from single-request tests.
- **Do the privacy invariants survive load?** Existence-uniformity, silent knock limiting, and
  fail-closed-to-gray are the product. A bug that only appears under contention (a timing split that
  widens, a shed path that leaks a status code) is the worst kind, so the lab asserts these *while
  the box is busy*, not only at rest.
- **What can the box actually carry, on this hardware?** A measured steady-state and peak number per
  usage size, replacing the placeholder thresholds in [Observability & Metrics](12-observability-and-metrics.md)
  §3a with a real baseline, per the repo's "no perf claim without a test" rule
  ([Build & Deployment](10-build-backend-and-deployment.md) §C).
- **How does it fail when pushed past that?** Past the ceiling, the design says non-sensitive
  endpoints return `503`, sensitive reads fall back to the uniform decoy, and the client renders
  gray. The lab pushes past on purpose and asserts it degrades *that* way, rather than crashing,
  leaking, or surprise-billing.

**Non-goals.** The lab talks to `stiapi` directly, so it does not test the Cloudflare edge or the
Caddy proxy. It does not exercise real push delivery (targeted wake is gated off; only the request
path is covered). It is not a security or cryptanalysis audit: it checks the existence and uniformity
*invariants*, not the strength of the crypto. And it ships no production change, so it has no
migration or backout. It sits above the unit, property, integration, and visual gates; it does not
replace them.

---

## 2. The shape: two planes, one orchestrator

The work splits into two planes that look similar but are not, and conflating them is the usual
mistake. Browsers **validate**; they do not **load-test**. You cannot push tens of thousands of
requests per second through real Chrome instances, and you do not need to: load is generated at the
wire, and a browser is reserved for proving that real user journeys still render correctly while
that wire is busy.

| Plane | Job | Substrate | Why this substrate |
| --- | --- | --- | --- |
| **Load plane** | Generate realistic and overload traffic; assert the wire-level invariants | TypeScript, running the **real production client** (`passport/src/api/client.ts` + `crypto/` + `store/`) in Node, fanned across `worker_threads` | Same language, same contract, no second encoding of a request to drift out of sync |
| **Behavioral plane** | Drive a handful of real user journeys; catch console errors; assert the UI renders the right state while the load plane runs | **Playwright** (TypeScript) | TS-native, first-class console / pageerror / requestfailed capture, parallel browser contexts, clean multi-origin support |

### 2a. The tooling decision, and the steelman of "no new languages"

**LOCKED (this doc): the lab is written entirely in TypeScript, drives the existing Go server, and
adds no third implementation language or load runtime.** The load generator is the production client
itself; the browser driver is Playwright.

The constraint is not really about languages, it is about **sources of truth**. A load tool written
in Lua (`wrk`, which `server/deploy/bench.sh` already uses for raw throughput), Python (locust),
Scala (Gatling), or k6's bespoke JS-on-a-Go-binary each forces a *re-encoding* of what a request is:
the id shape, the 4096-byte padding, the `X-Write-Token` header, the JSON bodies, the crypto. That
re-encoding is a second copy of the contract, and the repo already spends effort keeping copies in
lockstep ([contract.ts](../../passport/src/api/contract.ts) is mirrored from
`server/internal/contract/contract.go`, and the integration test fails on drift). A new-language
load harness reopens exactly that drift hole, and a load test that drifts from the real client is
testing a fiction. So the steelmanned constraint becomes a design principle: **the load generator
should be the real client, in the language it already lives in, so the traffic exercises the exact
code path a user hits and cannot drift.** `bench.sh` stays as the raw-HTTP ceiling probe (it answers
a different question, "what is the floor latency of the box with no client logic"), and the lab
layers realistic *flows* on top of it.

**Playwright over Cypress** for the behavioral plane (both are TypeScript, so neither adds a
language; the tie breaks on capability): Playwright runs many browser contexts in one process so it
can simulate several concurrent users cheaply; its `page.on('console' | 'pageerror' | 'requestfailed')`
capture is direct and out-of-process; and it handles multiple origins cleanly, which this app needs
because resolution crosses `sti.care` to `api.sti.care`. (A future Web-Push wake path will add a
service worker, which Playwright also supports, but that path is gated off today and not yet built
client-side, so it is not a current requirement.) [TESTING.md](../../passport/TESTING.md) already
names Playwright as the end-to-end tool, so this is also the path of least surprise. Playwright is
not entirely new to the repo either: `@vitest/browser-playwright` is already in the lockfile. The
behavioral plane still adds a real dependency though, `@playwright/test` plus a one-time browser
install, so it is budgeted, not free.

**The browser MCP is a development aid, not the artifact.** The MCP browser is interactive and good
for eyeballing a flow while building the lab; it is not reproducible, not CI-gateable, and cannot do
unattended setup and teardown. The committed lab uses Playwright. The MCP is the scratchpad.

---

## 3. The interaction taxonomy

Two layers: the wire operations the server sees (and that load is measured in), and the user flows
that fan into them. The wire set is closed and small; it is the full public surface from
`server/internal/server/server.go`.

**Wire operations** (the unit of load):

| Op | Endpoint | Character |
| --- | --- | --- |
| Resolve a badge | `GET /a/{id}` | The hot path. Existence-uniform: real ciphertext or id-seeded decoy, always 4096 bytes, always `200`. |
| Publish a status | `PUT /a/{id}` | Write-token gated, per-IP rate-limited, sheddable (`503`). The SQLite single-writer point. |
| Pull the account blob | `GET /acct/{id}` | Login / sync. `404` on a real miss (a deliberate, owner-only carve-out). |
| Push the account blob | `PUT /acct/{id}` | Last-write-wins, `X-Version` header, size-capped (`1 << 20`). |
| Knock | `POST /knock/{id}` | Contentless, existence-uniform (`{"status":"received"}` for every id), silently rate-limited per `(id, requester)`. |
| Targeted wake | `POST /notify`, `POST /push/register` | Gated off by default; included so the lab covers the path without asserting delivery. |
| Liveness / landing | `GET /healthz`, `GET /` | Used by setup readiness and as a non-sensitive baseline. |

**User flows** (what the behavioral plane drives, each fanning into the wire ops above), drawn from
the screen graph in `passport/src/ui/app/routes.ts`:

- **Onboard:** claim, recovery phrase, first-run setup (`PUT /acct`).
- **Publish status:** edit report, publish (`PUT /a` plus `PUT /acct`); republishing all of an
  owner's aliases on a state change is the sibling-alias fan-out noted in
  [Frontend to Backend Integration](11-frontend-backend-integration.md).
- **Share:** mint or reuse a share link, revoke, renew (`useShareLink.ts`).
- **Viewer resolves a shared link:** public resolution (`GET /a` then client-side decrypt to a
  green or gray badge); the load plane's read traffic is mostly this, plus decoy misses.
- **Viewer knocks; owner reads knocks** (`POST /knock`, then the owner's knock list).
- **Recovery-phrase login on a new device** (`GET /acct`).
- **Circles and partners** (knock / notify driven).

---

## 4. The usage and volume model

The product is **read-skewed by its nature**: a status is published rarely (weeks to months) but a
badge is resolved many times by partners and re-checked, and every decoy miss costs real read work
too. So the steady-state mix the load plane encodes is dominated by `GET /a`. The shares below are
the model's starting constants; they live in one config object in the lab and are tuned against the
first real runs, not asserted as fact.

| Op | Share of steady-state traffic | Driver |
| --- | --- | --- |
| `GET /a` | ~85% | viewers resolving and re-checking badges, plus decoy misses |
| `POST /knock` | ~6% | viewer pings |
| `GET /acct` | ~4% | logins and sync pulls |
| `PUT /acct` | ~3% | sync pushes on edit |
| `PUT /a` | ~1% | owners publishing or updating a status |
| `notify` + `push/register` | ~1% | wakes (path covered, delivery gated off) |

**Population and size.** Owners are the seeded population; viewers are a multiple of owners (a badge
is seen by several partners over its life), modeled at roughly 5 to 15 viewers per owner. Three
sizes, illustrative until calibrated against the box, with peak derived from steady-state by a
diurnal factor of 3 to 5:

| Size | Owners / viewers | Steady-state RPS | Peak RPS |
| --- | --- | --- | --- |
| Small | 100 / ~1k | 1 to 5 | ~15 |
| Medium | 10k / ~100k | 50 to 200 | ~600 |
| Large | 1M / ~10M | 5k to 20k | ~60k |

**The binding constraint is one VPS and SQLite's single writer.** The known knobs from
`server.go` set the structural ceiling: `MaxInflight` 256 (global concurrency), `SensitiveWait` 5s
(the sensitive-read fallback timeout), per-IP `5/sec` burst `20`, per-knock `1/sec` burst `10`,
`KnockTTL` 4 days. Most of these are env-configurable and the lab sets them: the per-IP limit
(`STI_IP_RATE_PER_SEC` / `STI_IP_BURST`), `MaxInflight` (`STI_MAX_INFLIGHT`), `SensitiveWait`
(`STI_SENSITIVE_WAIT`), and `KnockTTL` (`STI_KNOCK_TTL`). Only the per-`(id, requester)` knock rate
caps (`KnockRatePerID` / `KnockBurst`) are compiled-in, so the breakpoint the lab reports is against
whatever ceiling it configured (the shipped defaults, or a low `MaxInflight` when it wants the shed
onset observable without real saturation). `bench.sh` measures the raw floor latency of `GET /healthz`,
`GET /a`, and `PUT /a` on the hardware. The lab derives the size numbers above, drives proportional
mixes against the box, and reports headroom **against that measured floor**, so the capacity claim is
a test, not a guess. The read floods come from many simulated source IPs (set via
`X-Real-IP`, the only client address the origin trusts; the lab talks to `stiapi` directly, with no
Caddy in front, so it can set that header itself), so the per-IP limiter sees many distinct clients
rather than one loopback address masking the ceiling; and when the goal is the raw floor rather than
realistic per-client limits, the lab raises the env knobs above outright, as the harness already does.

**Finding the breakpoint is a read of the metrics, not a guess.** The capacity question has a precise
answer the loopback metrics endpoint hands us directly (section 7): the load at which
`sti_inflight_highwater` approaches `sti_inflight_max` and `sti_shed_total` /
`sti_sensitive_overload_total` begin to rise is the box's breakpoint. The stress run ramps and
watches those series to *locate and report* that breakpoint rather than asserting a number, and the
steady and peak budgets in the size table are then set a deliberate margin below it.

**The generator has its own ceiling, and the lab must not mistake it for the box's.** A single Node
host doing real per-request crypto cannot itself emit the large size's peak (tens of thousands of
requests per second), and decrypting every hot read on the generator would saturate the generator
before the server. So the load plane splits the work: a small **correctness sample** runs the full
client (seal, send, fetch, open, compare) to prove data flows, while the **bulk volume** replays
pre-sealed, pre-padded payloads and fixed ids with no per-request crypto, which is what lets one host
approach the box's read ceiling. Two consequences the doc states plainly rather than blurring: the
**hermetic local run co-locates the generator, the server, and the browser on one machine**, so its
latency and capacity figures are *indicative only*; the authoritative capacity numbers come from a
run against the dedicated instance with the generator on a separate host (section 8). And any number
the lab reports is labeled **driven** (actually emitted at that rate) or **extrapolated** (projected
from the saturation curve plus `bench.sh` beyond what one generator host can emit).

---

## 5. The orchestrator lifecycle

One TypeScript entrypoint owns the whole run as a sequence of phases, each of which records what it
did so teardown can undo it. It lives under `passport/src/loadlab/` (alongside `src/test-support/`, so
it is covered by typecheck, lint, and the integration runner), and the increment-1 gate runs as a
`*.integration.test.ts` through `vitest.integration.config.ts`. No new language and no separate runtime.

1. **Stand up.** Boot a throwaway Go `stiapi` on a free port against a fresh SQLite file in a temp
   dir, reusing the pattern in `passport/src/test-support/serverHarness.ts` (build once, spawn,
   wait for `/healthz`). Bind the loopback metrics listener on a **second free port**
   (`STI_METRICS_ADDR=127.0.0.1:<free>`, allocated the same way the harness picks the main port; the
   integration harness sets it to `off` to avoid fixed-port contention, so the lab allocates its own)
   so the lab can scrape blind aggregates while it runs. For the behavioral plane, build and serve
   the passport web app (a `vite preview`) with `VITE_API_BASE_URL` pointed at the throwaway
   `stiapi`, and set the server's `STI_ALLOWED_ORIGINS` to that preview origin: the served app's call
   to the api is cross-origin, and the server answers preflight only for an exact-match allowlisted
   origin (`server/internal/server/cors.go`), so without this the browser plane is blocked, the same
   CORS prerequisite [Frontend to Backend Integration](11-frontend-backend-integration.md) calls out.
   Capture the server's stdout and stderr to a file in the run directory. Record the temp paths and
   the PID for teardown.
2. **Seed.** Create the owner population with the **real crypto and store code**: mint keys, publish
   real alias payloads (`PUT /a`) and account blobs (`PUT /acct`), and mint share links. This makes
   reads hit real aliases, not only decoys, so the read path is exercised for real. The seeded ids are
   held in memory for the load plane to read against (the bulk-volume replay needs them); teardown is
   whole-datastore, so they need no per-id cleanup record (section 8).
3. **Drive load.** Run the weighted operation generator (the section 4 mix) across `worker_threads`,
   ramped to the target size's RPS, for a configured duration. Sample the metrics endpoint and the
   store row counts on an interval throughout.
4. **Drive the browser, concurrently.** While the load plane runs, a Playwright context walks a real
   owner-to-share-to-viewer-to-knock journey against the **same** instance, capturing console
   messages, page errors, and failed requests, and asserting each screen renders the expected state.
   The journey is self-contained (it creates its own owner and viewer through the UI); it shares the
   server with the load plane, not the seeded data, so it simply coexists with the background load.
   This is the "simulate usage with the script while the browser validates the rest" requirement.
5. **Assert as it goes** (section 6). Checks run inline against live responses and the scraped
   metrics, not only at the end, so a failure is captured with the context that produced it.
6. **Collect** (section 7) into a single timestamped run directory.
7. **Tear down and clear everything** (section 8). Always, including on failure or interrupt.

The **stress run** is the same orchestrator with the load phase ramped past the modeled peak until
the box sheds, and the assertion set switched to the degradation invariants (section 6b).

---

## 6. The assertions (how it catches usage bugs, not just crashes)

A run that only checks "nothing threw" catches almost nothing. The lab asserts the system's actual
contracts, and each assertion is pinned so a regression fails the run rather than getting eyeballed.

### 6a. Correctness under normal load (strict gates)

- **No lost writes.** For a sample of owners, publish then resolve concurrently with other traffic;
  the decrypted value must equal what was published. Under concurrent `PUT /acct` from two
  simulated devices, the `X-Version` header must advance monotonically and the surviving blob must
  be one of the two writes, never a torn mix.
- **Existence-uniformity, size and status.** Across the whole run, every `GET /a` response is
  exactly 4096 bytes and `200`, for real ids and nonexistent ids alike; every `POST /knock` is
  `200` with the single fixed body. Any deviation is a hard fail (it is an existence leak).
- **Knock limiting is silent and isolated.** A flooding requester against one id never receives a
  visible `429` (the knock limiter is silent by design), and a second requester's knocks for the
  **same** id still land, proving the per-`(id, requester)` keying is not a shared bucket.
- **Happy-path health.** Zero `5xx` on the modeled steady-state mix, and `GET /a` p99 within the
  budget the same run measures on the idle box (the budget is derived, not hardcoded).
- **Client journeys are clean.** Every Playwright journey finishes with **zero uncaught console
  errors and zero unhandled promise rejections**, and an induced-unreachable server (the browser
  plane blocks the api route via Playwright request routing, or points the app at a dead port)
  renders gray, never a crash or a thrown error surfaced to the user.

### 6b. Degradation under overload (strict gates)

- **Sheds the designed way.** Past the ceiling, non-sensitive endpoints return `503` and the per-IP
  limiter returns `429`; sensitive reads (`GET /a`, `POST /knock`) **never** return a visible
  `429`/`503` and instead fall back to the uniform decoy / fixed reply, exactly as
  `server.go`'s `uniformOverload` specifies. A sensitive endpoint emitting a non-`200` under load is
  a hard fail.
- **Recovers.** After the overload phase ends, the box returns to baseline latency and a `0` shed
  rate within a bounded window (no wedged state, no leaked goroutines or inflight slots that never
  free).
- **The client stays calm.** A shed response surfaces as gray in the browser, not a scary error
  state, matching [Frontend to Backend Integration](11-frontend-backend-integration.md) principle 3.

### 6c. Timing uniformity (characterized, not yet a gate)

The read-path timing gap between a real DB hit and the decoy HMAC is a **known, carried-open item**
([Build & Deployment](10-build-backend-and-deployment.md) §F). The lab therefore **measures and
reports** the hit-versus-miss latency distributions under load rather than gating on
indistinguishability, so we track whether load widens the gap and have a baseline to verify against
when the constant-time fix lands. This is called out explicitly so a green run is never misread as a
claim that timing uniformity already holds. Size and status uniformity (6a) are strict; timing is
characterized until the fix closes it, at which point this assertion is promoted to a gate.

### 6d. Cross-checks and silent-fault detection from the metrics endpoint

The blind metrics endpoint (`GET /metrics` on the loopback listener, the observability layer that
landed in `server: blind observability and metrics`) is not just an artifact to file away. It is the
server's own ground truth, and several gates above cannot be checked from the client at all without
it. The lab scrapes it throughout a run and asserts on the values.

- **Two invariants are verifiable only server-side.** The sensitive-read overload fallback is
  *invisible by design*: under saturation `GET /a` returns a decoy that is byte-identical to a normal
  miss, so a client cannot tell the fallback fired. Only `sti_sensitive_overload_total` proves it
  did. Likewise an internal store or decode fault behind a uniform reply never reaches the client; it
  surfaces only as `sti_errors_total{type=...}`. So section 6b's sensitive-path degradation gate, and
  a silent-server-fault gate, both *depend* on the scrape.
- **Silent faults fail the run.** On the normal mix, `sti_errors_total` must stay at zero across every
  subsystem (`store`, `decode`, `enqueue`, `janitor`). A nonzero count means a fault hid behind a
  decoy or a `202`, which is exactly the class of bug a client-only test misses.
- **Client and server views must agree.** Client-observed gray-mapped failures must reconcile with
  `sti_shed_total` plus `sti_ratelimit_rejections_total`; the seeded row count must match
  `sti_alias_rows` / `sti_account_rows`; and after teardown those gauges must return to baseline
  (section 8). A divergence is itself a bug (a lost write, a miscounted shed, an incomplete wipe).
- **Leak detection across the run.** `sti_goroutines` and `sti_memstats_heap_inuse_bytes` must return
  to their pre-load baseline after load stops, and `sti_inflight_current` must drain to zero; this is
  how section 6b's recovery gate catches leaked goroutines or inflight slots that never free.
  `sti_janitor_last_run_seconds` must keep advancing under load, proving the background loop is not
  starved.

### 6e. The metrics must themselves stay existence-blind (an inference test, not just a check)

Because the lab controls the population and every operation, it is the right place to *empirically*
test the residual that [Observability & Metrics](12-observability-and-metrics.md) §9 left flagged
for sign-off: can someone holding only the metrics scrape infer a subject-level fact? Two checks.

- **Hit and miss must move the same series.** A `GET /a` on a real, seeded id and one on a nonexistent
  id must move *identical* metric series by identical amounts (both bump
  `sti_requests_total{endpoint="/a/{id}",method="GET",status_class="2xx"}` and the duration
  histogram; neither moves any hit-versus-miss series, because by design none exists). The lab asserts
  this directly, extending the existence-uniformity gate (6a) to the telemetry itself.
- **The small-N timeline residual, measured.** With a single seeded owner, the lab performs one knock
  and one publish and checks what an observer watching only the scrape could infer from
  `sti_knock_rows`, `sti_db_size_bytes`, and `sti_send_queue_depth` moving. The expected result
  matches doc 12's reasoning (the gauges name a write or a knock, never a writer), but the lab turns
  that argument into a measured, repeatable observation whose outcome feeds doc 12 §10's small-N
  sign-off rather than staying prose.

---

## 7. Debug artifacts collected

Everything needed to explain any assertion, written to one timestamped run directory and summarized
at the end. Nothing here is shipped anywhere; it is local evidence for the operator running the lab.

- **Per-op latency histograms and outcome counts** from the load plane (by wire op and status).
- **The blind metrics scrape** sampled across the run and parsed for the assertions in 6d and 6e,
  not just filed: `sti_inflight_highwater` vs `sti_inflight_max`, `sti_shed_total`,
  `sti_ratelimit_rejections_total`, `sti_sensitive_overload_total`, `sti_errors_total{type}`,
  `sti_request_duration_seconds` per endpoint, the store gauges (`sti_db_size_bytes`,
  `sti_alias_rows`, `sti_account_rows`, `sti_knock_rows`, `sti_send_queue_depth`), and the runtime
  gauges (`sti_goroutines`, `sti_memstats_heap_inuse_bytes`, `sti_janitor_last_run_seconds`). These
  are the exact safe-aggregate signals from [Observability & Metrics](12-observability-and-metrics.md) §3.
- **The server's stdout/stderr log** for the run.
- **SQLite row counts** before and after, from the store's `Stats`, to confirm the seed and the
  teardown.
- **On any failed assertion:** the browser console log, a network HAR, and a screenshot for the
  behavioral plane; the offending request/response shape (sizes and statuses only, never plaintext
  bodies in a way that would persist a secret) for the load plane.
- **A run summary:** pass/fail per assertion, the measured steady and peak RPS, the headroom against
  `bench.sh`, and the characterized timing gap.

---

## 8. Data isolation and teardown: "clear everything afterwards"

This is a first-class requirement, not a cleanup afterthought, and it shapes the target choice.

**The unit of teardown is the whole instance and its database file, because the blind store exposes
no per-id delete.** The contract is GET/PUT/POST only; there is no `DELETE` endpoint today, and
self-serve deletion is itself still an open product item ([Data & storage](/docs/data)), not a solved
one. So "delete exactly what we created" cannot go through the API, and inventing a privileged delete
endpoint just for the lab would add the exact kind of surface the blind design avoids. The clean answer is to make every lab run **own its entire datastore** and
destroy it:

- **Default and recommended: a hermetic throwaway instance.** The lab provisions a fresh SQLite file
  in a temp dir, runs against it, and on teardown kills the process and removes the temp dir. Clearing
  is then **provable and total**: the database the data lived in no longer exists. This is the path
  for local development and CI, and it is the default.
- **Optional: a dedicated pre-launch instance.** To exercise "our system" on real hardware before
  there are users, the lab can target a **dedicated** stiapi instance (its own VPS or its own db
  file on the box), never the production database. Teardown is the same whole-datastore destruction as
  the hermetic path, just operator-run: stop the service, delete (or swap back) the db file, restart.
  No special SQL or admin surface, the same move as the hermetic case on a longer-lived box.
- **Never the production database.** Even pre-launch, the lab does not seed and then fail to fully
  clear a shared prod store, because there is no API path to selectively clear it. The carve-out for
  "test in our system" is satisfied by a dedicated instance, which can be wiped wholesale.

Teardown runs in a `finally` and on `SIGINT`/`SIGTERM`, so an interrupted or failed run still tears
down. The run summary asserts the post-teardown row counts are zero (hermetic) or back to the
recorded baseline (dedicated), and a run that cannot confirm clearing is reported as a failed run,
not a silent partial.

Knocks auto-expire after `KnockTTL` (4 days) regardless, but the lab never relies on expiry for
clearing; expiry is a backstop, not the mechanism.

---

## 9. Adversarial self-audit

The bar from [Observability & Metrics](12-observability-and-metrics.md) applies here too: could the
lab, or someone holding everything it produces, learn something about a real subject, or ship a
surface that erodes the blind story? Each concern, with its mitigation.

- **Does this ship a client-error channel that §5 of doc 12 rejects?** No. Doc 12 rejects collecting
  errors **from real users' devices in production**, because those devices hold real plaintext. The
  lab observes a browser **we drive, against a throwaway instance, on data we synthesized**. There is
  no real subject, the "plaintext" is generated test fixtures, and nothing is transmitted to us as a
  service: the console log is written to a local run directory and deleted with the rest of the run.
  The shipped app gains no error-reporting code. Pass, and this is the load-bearing reconciliation.
- **Could the lab leak real data because it points at prod?** Only if misconfigured to target the
  production database, which section 8 forbids structurally: the default is a hermetic instance, and
  the only real-hardware path is a dedicated instance that gets wiped wholesale. The lab refuses to
  run its destructive teardown against a configured production address. Pass, conditional on that
  guard existing in code.
- **Does the seeded synthetic data resemble real data closely enough to matter if it leaked?** It is
  random keys over random fixtures, so it names no person even before deletion. And it is deleted.
  Pass.
- **Does enabling the loopback metrics listener widen any surface?** It is bound to `127.0.0.1` on a
  throwaway instance and dies with that instance, matching the opt-in, loopback-only posture doc 12
  §5 requires. It is never the production listener. Pass.
- **Could the metric values themselves leak a subject?** This is no longer only an argument; the lab
  measures it (section 6e). Hit and miss move identical series, and the small-N gauge movements name a
  write or a knock, never a writer. The empirical result is the evidence behind doc 12 §9's small-N
  sign-off, and a future metric that moved differently for a hit would fail 6e here before it shipped.
  Pass, with that test as the gate.
- **Does generating overload against a real box risk a surprise bill or an outage?** The whole point
  of the deploy posture is degrade-not-bill ([Build & Deployment](10-build-backend-and-deployment.md)
  §D), and the lab tests exactly that. On a dedicated pre-launch instance there are no users to
  affect and no usage-billed resource to spike (the VPS is flat-rate). Alerts firing during a run are
  expected and acceptable. Pass.
- **Could the collected artifacts persist a secret (a write token, a key) to disk?** The load plane
  logs sizes, statuses, and ids, not bodies or tokens; the run directory is synthetic and disposable
  either way. The audit item is to keep the artifact writers from ever formatting a token or a
  plaintext body into a persisted line, checkable the same way doc 12 §4 checks the server's error
  lines. Pass, conditional on that check.

---

## 10. Where it lives, and how it runs

- **Location:** the load/wire plane is `passport/src/loadlab/` (TypeScript): it reuses
  `passport/src/api/` and `crypto/` directly, and setup/teardown reuse `test-support/serverHarness.ts`
  (extended with an opt-in loopback metrics listener and per-test env overrides). The behavioral plane
  is `passport/e2e/*.pw.spec.ts` (Playwright), kept outside `src/` so Playwright's own toolchain owns
  it. Both read the one catalog (`src/loadlab/behaviors.json`).
- **Commands.** The wire/telemetry gates run via `npm run test:integration` (`*.integration.test.ts`);
  the browser gates via `npm run test:e2e` (Playwright, which boots a throwaway server, seeds a real
  card, builds + previews the app pointed at it, and drives a browser). The operator stress plane runs
  via `npm run loadlab -- --mode stress --size small` (also `--mode normal`, sizes
  `small`/`medium`/`large`, and `--target URL` for a dedicated box; default hermetic): it measures the
  read ceiling, characterizes the hit-vs-decoy timing gap, ramps to the shed onset (the capacity
  breakpoint), and tears down. It is not a CI gate. On a hermetic box it caps `MaxInflight` low so the
  shed onset is observable without real saturation; a dedicated `--target` is driven at the real cap.
- **CI:** the hermetic small normal run is cheap and deterministic enough to gate on (it is mostly a
  concurrency-correctness test); the larger and stress runs are operator-invoked, because their
  numbers depend on the target hardware and they are characterization, not a pass/fail unit test.
  The CI cost beyond the existing suite is small but real: the run needs Go on the runner (already
  required by the integration suite, which builds `stiapi`) and a one-time Playwright browser install
  for the behavioral plane.

---

## 11. Decisions, and the few open calls

**Decided:**

- **TypeScript only; the load generator is the real client; Playwright for the browser.** Section 2a,
  locked.
- **Teardown is whole-instance destruction; default hermetic; no per-id delete; never prod.**
  Section 8.
- **Size and status uniformity are strict gates; timing is characterized until the constant-time fix
  lands.** Section 6c.
- **The loopback metrics endpoint is a validation instrument, not just an artifact.** Two strict gates
  (the sensitive-overload fallback and silent server faults) are verified only through it. Sections 6d
  and 6e.

**Open, and small:**

- **The exact mix and size constants** (section 4) are starting proposals; the first runs calibrate
  them, and the calibrated values are written back here so the model is auditable.
- **Whether the small hermetic run gates CI from day one** or starts as an operator-invoked job until
  it is proven non-flaky. Leaning gate, after a settling period.
- **Provisioning the dedicated pre-launch instance** (its own VPS or a second db file on the box) is
  an operational choice for the first real-hardware run; the lab supports either via `--target`.
- **The small-N inference test's outcome** (section 6e) feeds doc 12 §10's small-N sign-off; whether
  it changes any gauge's coarseness is decided there, not here.

---

## 12. The behavior catalog and the `/behaviors` report

The catalog is the **full map of intended product behaviors**, not just the ones the load lab gates.
It spans the whole product, with each behavior naming the suite that validates it, so it is the team's
single "does the product behave the way we intend" reference. It is an **internal** artifact (not
published), structurally modeled on the public `/promises` report (the in-app
[Promises](../../passport/src/ui/promises/Promises.tsx) surface, a pure function of the promises data
gated by `promises.test.ts`).

- **Single source of truth:** `passport/src/loadlab/behaviors.json`. Each behavior carries an id,
  category, the intent (what we mean to be true), the check (how it is validated in one line), a
  status, a layer, a doc reference, and a **`pin`**: the repo path of the test or module that
  validates it (the load lab, the Playwright suite, the stress module for characterized measures, or a
  unit/integration/Go suite that owns it, e.g. `src/crypto/payload.test.ts`,
  `../server/.../notify_test.go`).
- **Organized by importance:** categories run most trust-critical first, privacy and existence-
  uniformity, then trust integrity & sharing, account & recovery, durability, access control, fairness,
  degradation, observability, the deferred targeted-wake, lifecycle, and finally client behavior.
- **Status:** `validated` (a passing test pins it), `characterized` (measured and reported, not yet a
  gate, e.g. the read-timing gap and the capacity breakpoint), or `planned` (intended, no test yet).
- **Kept honest by meta-tests:** a behavior pinned in the load lab (or in Playwright, for browser
  behaviors) must be covered by a tagged test there, every tagged test must name a behavior that suite
  owns, and **every behavior's `pin` file must exist**. So the map can never claim coverage it lacks
  nor name a vanished suite, even for behaviors owned by other suites.
- **Rendered:** [build-behaviors.mjs](../../deploy/build-behaviors.mjs) (`npm run behaviors`, stdlib
  only) reads the catalog and writes `reports/behaviors/index.html`, grouped by category with status
  chips, behavior ids, and the pinning suite per card. `reports/` is gitignored and sits outside the
  `dist/` publish dir, so it is never served; regenerate it on demand. The committed, talk-about-it
  source of truth is the catalog (`behaviors.json`) plus this section.

This makes the whole product legible to anyone on the team: the report shows every intended behavior,
where it is pinned, and the honest few that are characterized rather than gated, in one ordered map.

---

Mechanics of the server and its shed/uniformity guarantees live in
[Build, Backend & Deployment](10-build-backend-and-deployment.md); the seam that produces this
traffic lives in [Frontend to Backend Integration](11-frontend-backend-integration.md); the blind
aggregate signal the lab reads while it runs lives in
[Observability & Metrics](12-observability-and-metrics.md).
</content>
</invoke>

# sti.care: Build, Backend & Deployment

_New, June 17, 2026._

*The "with what." How the prototype becomes real in-repo source, what the server actually is,
and how it deploys so that load sheds instead of generating a surprise bill. Pairs with the
[Design doc](/docs/design) (mechanics), [Data & storage](/docs/data) (what lives where), and the
[Decisions log](/docs/decisions) (the locked choices this build must honor). Not legal advice.*

---

## Two principles this build is organized around

1. **The server is blind and dumb (already locked).** It stores opaque ciphertext by opaque id,
   routes contentless pushes, and rate-limits. It runs no badge logic, holds no PII, and never
   sees the social graph. Every decision below inherits from that: a blind key-value store is
   cheap to run and trivial to scale on one box, because there is nothing expensive to do.
2. **Degrade, never surprise-bill.** The cost ceiling is fixed by the host, not by traffic. When
   load exceeds capacity the server sheds requests (429 / 503); it never autoscales into a bill.
   This is safe because [02-decisions.md:155](../docs/02-decisions.md) already locks
   **unreachable server, slow server, or stale sync, then gray, never stale-blue.** A shed
   request renders as gray on the client, which is a correct, expected state, not an outage.
   **One carve-out:** the existence-sensitive endpoints (`GET /a/{id}` and `POST /knock/{id}`)
   never shed with a visible 429 / 503, because a distinct status or timing there is an existence
   oracle (Design §Knock locks "never a distinct 429"). They throttle internally and always return
   the same padded, existence-uniform response. Visible shedding applies only to the non-sensitive
   endpoints.

---

## A. The frontend prototype becomes real in-repo source

- **LOCKED (this doc): Vite + React + TypeScript, built to static files.** The current prototype
  is a Napkin export (React + JSX via in-browser Babel, shipped as `passport.zip`). The modules
  port directly into typed source the repo can diff, test, and build, replacing the
  export-a-zip round trip. The deploy path stays the same shape (static files to `gh-pages`
  under `/passport/`), it just builds from source in-repo instead of from an opaque zip.
- **TypeScript is load-bearing, not decoration.** The product is a set of hard invariants (the
  two-state badge, the "On HIV prevention" umbrella that must never split, the per-site logic
  that must never reach the view layer). Each becomes a type plus a test, so it cannot silently
  regress. This follows the repo's existing split: pure logic with no DOM access, tested in Node
  (the `data.js` / `render.js` pattern in `public/`).
- **A pure core module, framework-free.** Badge resolution, the 90-day clock, per-site
  "tested clear OR not exposed", clearance-window math, and all crypto live in a module with no
  React and no DOM. It tests exhaustively in Node and is the one place the invariants are
  enforced. The view layer consumes it and never recomputes a badge.
- **PWA, offline-first.** The encrypted store lives in IndexedDB. The key is derived locally
  (Argon2id over the passphrase, or WebAuthn-PRF / biometric) and never transmitted. The blob is
  sealed with AES-GCM via WebCrypto. This realizes the on-device model from
  [Data & storage](/docs/data) directly.
- **Hosting is free and flat.** Static output to `gh-pages` (as labs already does) or Netlify (as
  sti.care already does). A static frontend has no marginal cost.
- **Two artifacts, one repo.** The root README describes the already-live, no-build info site in
  `public/` (Netlify, four languages). The passport PWA is a separate artifact that builds to
  `/passport/`. Once this lands as real source, the root README should say both exist. The passport
  app's own i18n is unspecified and needs its own decision (the info site is four-language; the
  passport prototype is English-only today).

---

## B. The backend

### What it is

A single Go binary with an embedded **SQLite** database (WAL mode), behind **Cloudflare**. The
data is ciphertext addressed by opaque id plus a few routing tables, which is a textbook embedded
key-value workload. SQLite in WAL mode serves very high read throughput from one small box, and
the hot path (resolving a public alias from a shared link) is a single indexed lookup.

### The whole API surface

It is small on purpose. Every value below is opaque to the server. This is the v1
core read/write surface; later work adds routes around it (the notify inbox in doc
13, the Findable `/u` directory in doc 17, `/republish` in doc 11, and the gated
`/admin/*` surface in doc 20), all still opaque-only.

| Route                       | Does                                                            | Notes                                                                 |
| --------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------- |
| `GET /a/{id}`               | Return alias ciphertext (the hot read: passport resolution)    | Cloudflare proxies but does not cache it in v1 (see §C). Decoy bytes on a miss. |
| `GET /acct/{id}`            | Return the account sync blob                                    | Addressed by an opaque, key-derived id. Returns the stored `version`. |
| `PUT /acct/{id}`            | Replace the account sync blob                                   | Write-token gated, a per-account second factor symmetric with aliases (a leaked id alone cannot overwrite). Optional `X-Version` precondition gives optimistic concurrency: a stale write is refused with 409, not clobbered. |
| `DELETE /acct/{id}`        | Remove the account sync blob                                   | Write-token gated like the PUT; idempotent. |
| `POST /notify`             | Enqueue a contentless wake for `hash(notify_token)`            | Constant-time intake: enqueues the token hash without a lookup; the drain resolves real-vs-unknown off the request path (§F). |
| `POST /push/register`      | Store a Web Push subscription for a `routing_endpoint_id`       | Contentless pings only.                                             |
| `POST /knock/{id}`         | Contentless, rate-limited knock against an alias               | Auto-expiry ~4 days; per-requester and per-id limits (locked).     |

**The server runs no badge logic, and is authoritative for nothing about a user's
status.** The blue/gray badge is computed on the OWNER's device and sealed into the
card; the server stores and returns opaque bytes and could not tell blue from gray if
it tried. "Resolving a badge" everywhere in these docs means the CLIENT got the
ciphertext (from `GET /a`, or in person over a QR code) and computed the badge
LOCALLY. The client is the source of truth for status; the server is dumb storage.
This is a common source of confusion, so it is stated plainly: a status is never
"on the server" in any readable sense, the server only ever holds bytes it cannot
read.

The pull "go get tested" fallback (Decisions §Partner notification) is a **static client page**, not a
server endpoint, so there is no `/poll` route in v1. A server poll only becomes safe paired with its
cover-traffic mitigation (broadcast wake + uniform "anything for me?"); that endpoint lands together
with that mitigation, post-MVP, never in an unsafe interim form (see §F).

### Storage shape (SQLite)

Mirrors the table in [Data & storage](/docs/data); nothing readable without a client key.
(`routing_endpoint_id` is an opaque routing token, not a display handle. Data & storage calls the
same value `opaque_handle`; the server never sees a user-visible handle, which lives only inside
ciphertext, so the backend names it for what it is.)

- `alias(id PK, ciphertext, updated_at)`: public and private passport payloads.
- `account(id PK, ciphertext, version, updated_at, write_auth)`: per-account sync blob. `write_auth` (hash of the account write token) gates overwrite/delete; `version` backs the optimistic-concurrency precondition (`X-Version`, 409 on a stale write).
- `notify_route(token_hash PK, routing_endpoint_id)`: routing for the anonymous nudge.
- `push_endpoint(routing_endpoint_id, subscription, created_at)`: contentless wake targets.
- `send_queue(id PK, routing_endpoint_id, available_at, created_at)`: the server-side send cycle (never surfaced to a user, per the locked two-timing-jobs rule). **v1 is a simple jittered single send** (a random delay before fan-out gives most of the observable timing decorrelation); the true cross-user batching cycle lands when there is a population to batch across. The two-timing-jobs principle stays locked either way.
- `knock(id PK, target_id, requester_hash, created_at, expires_at)`: contentless knocks, rate-limited and auto-expiring.

Rate-limit token buckets live in memory for speed (optionally checkpointed to SQLite), so a
restart costs at most a brief window of looser limits, never correctness.

Writes serialize through a single connection (the pool is capped to one) and every transaction opens
with `BEGIN IMMEDIATE`, so concurrent writers wait and serialize cleanly instead of racing into a
snapshot-upgrade conflict that silently drops an acked write. This single-writer serialization is
load-bearing for durability, not a tuning knob, and is pinned by the concurrency tests (a many-writer
run asserts every acked write persisted).

### Decoy and uniformity (a correctness requirement, not an optimization)

`GET /a/{id}` for a missing or undecryptable id returns **decoy, ciphertext-shaped bytes uniform in
size** with a real hit, so "doesn't exist" and "can't read this" are indistinguishable in shape
(from [09-data-and-storage.md:42](../docs/09-data-and-storage.md)). This is pinned by a test that
asserts the status, length, and decoy stability match across hit and miss, because it is a privacy
invariant, not a nicety. The test covers response *shape*, not *timing*: the read-path timing
difference (a DB hit vs the decoy HMAC) and the write-path timing on `/knock` and `/notify` are
carried as still-open items (see §F), not closed by this test.

### Why not Postgres / a managed DB / serverless

- **No per-request-priced primitive.** No Lambda, API Gateway, DynamoDB-on-demand, or managed
  Postgres. Those are precisely the surprise-bill vectors: cost scales with traffic and has no
  native hard cap. A compiled binary on a fixed box has a flat cost regardless of load.
- **SQLite is the production datastore here, not a test shim.** Integration tests therefore run
  against real SQLite (the same engine production uses), which satisfies "test against the real
  datastore." There is no Postgres to stand in for.

---

## C. Performance model

The design target is "highest request volume on the smallest box." The levers, in order of
impact:

1. **Cloudflare fronts the origin (proxy, not cache, in v1).** It gives free DDoS protection and
   unmetered egress to users, which is what lets a small origin survive real traffic. It does
   **not** cache `GET /a/{id}` in v1: a single indexed SQLite lookup is plenty fast, and not
   caching removes a whole class of correctness traps (cache outliving revocation, cached-miss
   uniformity, edge challenges that would leak existence). Turn on edge caching only after a
   benchmark says the origin needs it, with the same "no claim without a test" discipline applied
   below.
2. **SQLite WAL on local disk.** Single-indexed-lookup reads with no network hop to a database.
   Concurrent readers do not block on a writer in WAL mode.
3. **A compiled, low-allocation server.** One static binary, small memory footprint, no runtime to
   warm.

**Honest gap:** the specific "N requests/sec on box size X" claim is not asserted until there is a
benchmark. A query-plan assertion (the alias read uses its index) plus a load-test target land
before any number goes in the README, per the repo's "code beats manual" rule. Do not ship a perf
claim this doc cannot back with a test.

### If edge caching is ever turned on (deferred)

Not in v1 (see lever 1). When a benchmark later justifies it, it must not outlive revocation or
freshness: cache only public-alias reads (never private/authorized), keep a short TTL so a revoked
alias stops resolving within seconds without any purge machinery, enforce the 24h wallet-freshness
check client-side (never satisfied by a cached 200), and keep any *visible* edge challenge off the
existence-sensitive endpoints (`/a`, `/knock`), where a challenge response is itself an oracle.
Plain token-bucket rate limiting at the edge is fine; a CAPTCHA/JS-challenge on those two is not.

---

## D. Deployment: how it degrades instead of billing

**LOCKED (this doc): flat-rate VPS origin behind Cloudflare.** The chosen host is a fixed-price
VPS (Hetzner CX-class or equivalent), a few euros a month, flat.

The degrade chain, end to end:

1. **Flat-rate origin.** The bill cannot grow with traffic because there is nothing metered to
   grow. This is the whole reason for choosing a fixed-price box over AWS, whose egress has no
   native hard cap.
2. **Cloudflare free tier in front.** Proxies the origin, absorbs spikes, blocks abuse, and carries
   egress to users at no charge.
3. **In-process load shedding.** The server caps concurrent in-flight requests and token-bucket
   rate-limits per id and per IP. Non-sensitive endpoints return 429 / 503 past capacity instead of
   falling over; the two existence-sensitive endpoints ride the uniform path instead (the carve-out
   in Principle 2). Even under catastrophic overload, `/a` and `/knock` return their uniform
   existence-blind response, never a distinguishing status code.
4. **The client already absorbs it.** Shed or unreachable, then gray, never stale-blue. Reads are
   idempotent and retry; sync writes retry later. Shedding is invisible-correct, not a failure.
5. **Backups, and no runaway invoice.** A nightly `sqlite3 .backup` to the same flat VPS disk
   (rotated) is enough disaster recovery for v1: the server holds only ciphertext, and every
   client's IndexedDB store is the real source of truth, so the server is a sync/routing cache, not
   the system of record. The failure mode of last resort is "site offline, so gray everywhere,"
   which is safe by design. There is no configuration in which traffic produces a runaway invoice.
   (Cross-host replication, e.g. Litestream to object storage, is a post-MVP add when there is user
   data worth a cross-host DR story; it also adds a second metered vendor, so it waits.)

### Edge and origin hardening (live)

The origin is reached only through Cloudflare, and that path is locked down at three independent
layers so that knowing the origin IP is not enough to reach it:

1. **Firewall: Cloudflare IPs only.** `ufw` allows 80/443 only from Cloudflare's published ranges
   (SSH stays open). A direct hit on the origin IP is dropped.
2. **TLS: a Cloudflare Origin Certificate, no ACME.** Caddy serves a 15-year CF-signed origin cert
   instead of a Let's Encrypt cert. This is deliberate: the firewall above plus the edge's
   "always use HTTPS" mean an ACME HTTP-01 / TLS-ALPN challenge could never reach Caddy, so
   automatic renewal would eventually fail. The origin private key is generated on the box and
   never leaves it (Cloudflare only signs a CSR). Cloudflare connects with Full (strict), which
   trusts this cert.
3. **mTLS: Authenticated Origin Pulls.** Caddy requires a client certificate signed by
   Cloudflare's Origin Pull CA (`require_and_verify`), so a TLS handshake from anything that is not
   Cloudflare is refused outright. Global (shared-CA) AOP is enabled; it proves "a Cloudflare
   connection," and combined with layer 1 that is solid defense in depth. Per-zone AOP (a custom
   uploaded client cert) is the stronger future step, but its marginal value is small given the
   app's own write-token auth.

Edge configuration, all on the Cloudflare free plan (no metered features, no surprise bill):

- **DNSSEC** signs the zone; the DS record is published at the registrar (Squarespace).
- **Per-client rate limiting at the edge.** A free rate-limit rule throttles write methods
  (`POST`/`PUT`) at 20 requests / 10s per client IP, then blocks for 10s. This is where per-client
  throttling lives, because the blind origin intentionally never sees the real client IP (Caddy
  sets `X-Real-IP` to the Cloudflare edge, not `CF-Connecting-IP`). The origin keeps its own
  coarse in-process shedding as a backstop.
- **Free Managed Ruleset** (high-severity CVE signatures) is applied automatically; configurable
  managed rulesets are a paid feature and intentionally not purchased.
- **HSTS, min TLS 1.2, always-use-HTTPS, 0-RTT, early hints** are on at the edge.

`GET /a/{id}` is still **not** edge-cached (see §C lever 1): caching per-id responses would create
a cache-state oracle (HIT vs MISS leaks whether an id was recently fetched), and purge-on-write
would force a Cloudflare API token onto the blind origin. The single indexed SQLite lookup does not
need it.

**Edge mitigation is rate-limit-only, never a visible challenge.** The two things the live config
above does not state, and that any future edge change must preserve, are:

- **Bot Fight Mode (and Super Bot Fight Mode) stays OFF on the API zone.** It answers suspected
  bots with a managed/JS challenge. The app calls the API with `fetch`, which cannot solve a
  challenge, so it would break legitimate clients; and a challenge on an existence-sensitive read
  is itself an existence oracle. Bot defense here is the rate-limit rule plus the origin lock-down,
  not a challenge.
- **No rule ever issues a challenge (Managed Challenge, JS Challenge, Interactive/CAPTCHA) on the
  existence-sensitive paths,** above all `GET /a/{id}` and `POST /knock/{id}`. A challenge page
  served on a real id but not a decoy (or vice versa) leaks whether the id exists, breaking the
  existence-uniform guarantee the decoy response is built to hold. The only edge action on these
  paths is Block (429) past the rate limit.

These are operator-verifiable in the dashboard (Security > Bots shows Bot Fight Mode off; the WAF /
rate-limiting rules show Block, not Challenge, as the action). Everything else in this subsection is
recorded as live.

---

## E. Build order

1. **Pure core** (badge + crypto + clearance math), framework-free, with full tests. No UI, no
   server.
2. **Port the prototype screens** onto that core (Vite / React / TS), screen by screen per
   [07-screen-by-screen-build-guide.md](../docs/07-screen-by-screen-build-guide.md), closing the
   gap from the old four-light model to the approved two-state badge.
3. **Backend**: the blind key-value store, routing, and rate limiting, integration-tested against
   real SQLite, with the decoy-uniformity test in place.
4. **Wire** sync, public resolution, and contentless push end to end.
5. **Deploy**: static frontend (free) plus the Go origin on the flat-rate VPS behind Cloudflare,
   with the nightly local backup.

---

## F. Open items (carried, not solved here)

- **Targeted-push recipient-set leak, and the `/poll` fallback.** Until the generic broadcast/cover
  wake plus uniform "anything for me?" poll ships, the server can observe which routing endpoints
  receive an exposure ping. Tracked in [Open questions](/docs/open-questions). v1 ships **no**
  `/poll` endpoint (the pull fallback is a static client page); the server-side poll lands together
  with its cover-traffic mitigation, post-MVP, so it never exists in a privacy-incomplete interim
  form.
- **Read-path and write-path timing (not just response shape).** The decoy test pins the *shape*
  of `GET /a/{id}` (status, length, stable decoy), but a real read is a DB hit while a miss is the
  decoy HMAC, so total time can still differ; likewise a real knock writes a row while a miss does
  no work (Decisions still-open 5; Design §Knock). Equalizing *total* response time across
  real / fake / over-limit is not yet modeled by the prototype; carried. **`POST /notify` is now
  constant-time**: it enqueues the token hash without ever looking the route up, so the request
  does identical work for a known and an unknown token (the drain resolves real-vs-unknown off the
  request path, and an unknown token wakes nobody). `TestNotifyIntakeIsConstantTime` and
  `TestNotifyUnknownTokenWakesNobody` pin both halves.
- **Account deletion and export.** A self-serve "delete everything tied to me" and "download what
  is held about me." Since the server holds only ciphertext and opaque tokens, the open question
  is what is even meaningful to export. Carried from [Decisions log](/docs/decisions).
- **SSO recovery anchor and blind-routed email.** Both post-MVP, both off by default, both still
  needing a client key to decrypt anything.

# sti.care: Sibling-alias Decorrelation (plan)

_New, June 23, 2026._

_Plan for the deferred "sibling-alias decorrelation" work named in
[doc 11](11-frontend-backend-integration.md) and depended on by Findable
([doc 17](17-vanity-namespace-governance.md), gate item 4). It defines the threat,
the options and their tension, a recommended phased approach, and the concrete
work items, so the build is a known quantity. Nothing here is built yet; this is
the spec to approve before implementation._

---

## The gap

On a status change the owner's device republishes every one of their aliases in
one window: `republishOwnerCard` does `Promise.all(records.map(republishCard))`
(`passport/src/store/ownerCard.ts`). An observer who sees those writes can
correlate the opaque ids as one owner, defeating the behavioural-unlinkability
goal that the per-alias face (doc 15) and opaque ids otherwise protect. The same
applies to any future scheduled wake of named (Findable) aliases.

## Two vantage points (they differ, and it matters)

- **The origin** (the Go blind store) sees the alias-row writes and their timing,
  but **not the client IP**: Caddy sets `X-Real-IP` to the Cloudflare edge and
  strips `X-Forwarded-For` / `CF-Connecting-IP` (`server/deploy/Caddyfile`), so
  the origin's only correlation signal is **timing** (N writes in a tight window).
- **The Cloudflare edge** sees the real client IP and timing, so it can correlate
  by **IP + timing**. We do not control Cloudflare's internal logs, so the edge
  story is partly request-shaping (fewer / spread requests) and partly retention
  policy, not something the origin can fully fix.

Decorrelation therefore has two jobs: blur **apply-timing at the origin**, and
reduce the **IP+timing signal at the edge**.

## The core tension

The notify cover-wake (doc 13 §2; `DrainSends` / `fanOutCover`, jittered over
`CoverWindow`, gated off) is the precedent: a server-side queue applies work at
jittered times mixed across the whole population, so no single job is
distinguishable. Mirroring it for alias republishes runs into a tension:

- To decorrelate **apply-timing at the origin**, the device hands the new
  ciphertexts to a server-side queue that applies them at jittered times mixed
  across all users. Good for the origin.
- But a single **batch upload** of an owner's N ciphertexts makes the grouping
  *explicit* to the origin (N ciphertexts in one request = one owner), which is
  worse than the timing inference it replaces.
- Uploading each alias **separately** avoids the explicit batch but re-introduces
  per-request timing, and (at the edge) same-IP+window grouping.

So there is no free decorrelation: the design trades explicit-grouping vs
timing-grouping vs cost (cover traffic).

## Options

1. **Client-side jittered spread (cheap, no server change).** The device
   republishes each alias at an independent random offset over a window instead of
   in one burst. Removes the tight-window origin signal and weakens edge timing.
   Cost: a status change propagates over that window, not instantly; same-IP at
   the edge still links them if the window is observed whole. Partial, but a real
   reduction for ~zero infra.
2. **Server-mixed apply queue (the doc-11 "server-mediated" fix).** The device
   uploads each alias's ciphertext as an independent queue entry (not a batch);
   the origin applies them at jittered times interleaved across all users'
   queued writes (reuse the `send_queue` + drain shape). Breaks apply-timing at
   the origin via cross-user mixing. Residual: the uploads themselves are still
   edge-visible per-IP; mitigate by spreading uploads (combine with option 1).
3. **Cover traffic.** When an owner republishes, also schedule cover republishes
   across unrelated aliases so any window holds many owners' writes (the literal
   analogue of the cover-wake broadcast). Strongest, but expensive (write
   amplification across the population) and only worth it if 1+2 prove
   insufficient.
4. **Accept a bounded, stated leak.** Document the residual correlation as an
   honest limit (as today), if the product decides the cost of 2/3 outweighs it.

## Recommended approach (phased)

- **Phase A (do first):** option 1, client-side jittered spread in
  `republishOwnerCard` (replace `Promise.all` with independent jittered offsets,
  bounded so a status change still propagates within a sensible window). Pure
  client, no schema, immediately reduces both signals. Ship behind the same
  decorrelation flag so it can be tuned.
- **Phase B:** option 2, the server-mixed apply queue, reusing the cover-wake
  machinery (a `republish_queue` table with jittered `available_at`, a drain that
  applies cross-user-interleaved, gated off until validated). Uploads stay
  per-alias and jittered (from Phase A) so grouping is never explicit.
- **Phase C (only if needed):** option 3 cover traffic, measured against whether
  A+B leave a meaningful residual.

This satisfies Findable gate item 4: a **named** alias is just an alias with a
directory entry, so it rides the same republish/wake path; once A+B cover the
republish schedule, "decorrelation extends to named aliases" holds with no
Findable-specific work.

## Work items

1. **Phase A:** rewrite `republishOwnerCard` to schedule per-alias republishes at
   independent jittered offsets within a bounded window (a `decorrelate` flag +
   a configurable window). Tests: all aliases still end up republished; the
   schedule is spread, not a burst.
2. **Phase B (server):** `republish_queue` table + `EnqueueRepublish` /
   `DueRepublishes` store methods + a drain step in the existing pipeline that
   applies due entries cross-user-interleaved with jitter, gated by the same
   off-switch as `DrainSends`. The device PUTs to an enqueue endpoint instead of
   directly to `/a/{id}` when the flag is on.
3. **Phase B (client):** route republishes through the enqueue path when the flag
   is on; keep the direct path as the fallback.
4. **Metrics/limits:** the queue rides the existing existence-blind telemetry
   discipline (no per-owner counts that re-leak the grouping).
5. **Flip + validate:** enable behind the flag, measure window behaviour, then
   decide on Phase C.

## Honest limits (carried)

- The edge (Cloudflare) sees client IPs; no origin-side change fully removes
  edge-side IP+timing correlation. Spreading + retention policy bound it; it is
  not eliminated.
- Jittered spread delays status propagation by up to the window; the window is a
  privacy/latency trade to tune, not a free win.
- Until Phase A ships, the current burst behaviour stands and is the stated gap.

## Open

> **OPEN:** the window length(s) for Phase A jitter (privacy vs how stale a
> just-changed status may look to an existing link-holder).

> **OPEN:** whether Phase B's enqueue endpoint needs its own existence-uniform
> shape, or whether per-alias enqueue inherits the alias write path's guarantees.

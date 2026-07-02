# sti.care: Sibling-alias Decorrelation (plan)

_The "sibling-alias decorrelation" work named in
[doc 11](11-frontend-backend-integration.md) and depended on by Findable
([doc 17](17-vanity-namespace-governance.md), gate item 4). It records the threat,
the two vantage points it defends, the built mechanism and the trade it takes, the
residuals it does not close, and the stronger measures deliberately left deferred._

---

## Status: BUILT (server-mixed apply queue, option 2)

The server-mixed apply queue is built and ON by default. `republishOwnerCard`
(`passport/src/store/ownerCard.ts`) no longer bursts: when an owner has two or more
shared aliases it seals each card and hands the whole set to `POST /republish` as
one batch. The server (`server/internal/server/republish.go`) queues each op in
`republish_queue` at an INDEPENDENT jittered `available_at` over `RepublishWindow`
(`STI_REPUBLISH_WINDOW`, default 20 min) and the janitor (`DrainRepublishes`) applies
each as a write-token-gated alias overwrite when its time arrives. The window is
deliberately many janitor ticks wide (see "Honest limits"): the apply granularity is
the tick, so a window of one or two ticks would let an owner's ops land in the same
drain pass and re-correlate. The apply is
guarded (`ApplyRepublish`): it overwrites the alias only when the alias still exists
and has NOT been written since the op was enqueued, so a deferred snapshot can never
revert a newer write or un-revoke a card (see "Honest limits"). A single-alias owner
still publishes directly (no sibling to decorrelate, so no point delaying the status
update).

**What this achieves and the trade taken.** The publicly observable thing, when
each alias's ciphertext CHANGES, is now decorrelated: an observer polling two of an
owner's aliases no longer sees them change in the same instant. Against a network /
edge observer it is also strictly better than the old burst, which was N visible
`PUT /a` requests: it is now ONE request whose contents are TLS-hidden, so the count
and timing of the per-alias writes no longer leak to the edge at upload time.

The trade, called out in "the core tension" below, is that the single batch makes
the grouping EXPLICIT to the origin (N ciphertexts in one request). We accept it:
the origin is the blind-trusted party, it is IP-stripped (so it already could infer
the grouping from the old same-instant timing burst), and it can decrypt none of the
batch. So the batch converts an inferable timing-grouping into an explicit one at the
already-trusted origin, while removing the timing signal from the public apply
stream and from the edge. Stronger measures (per-alias upload spread, cover traffic)
remain available if the origin-grouping residual ever matters; see "Deferred and
conditional follow-ups".

---

## The gap this closed

Before the queue, on a status change the owner's device republished every one of
their aliases in one instant (a `Promise.all` of per-alias `PUT /a`). An observer
who saw those writes could correlate the opaque ids as one owner, defeating the
behavioural-unlinkability goal that the per-alias face (doc 15) and opaque ids
otherwise protect. The same would apply to any scheduled wake of named (Findable)
aliases. The server-mixed apply queue above is what removes that same-instant
signal; the rest of this doc records the vantage points it defends against, the
trade it takes, and the residuals it does not close.

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

This also satisfies Public link gate item 4 (doc 17): a **named** alias is just an
alias with a directory entry, so it rides the same republish path and its
decorrelation comes for free, with no public-link-specific work.

## Deferred and conditional follow-ups

What shipped is the server-mixed apply queue (option 2 in the original plan). Two
stronger measures were designed and deliberately NOT built, because each trades the
accepted origin-grouping back into a worse signal or into write amplification. They
stay available if a concrete need appears; do not build them speculatively.

- **Per-alias upload spread (client).** Instead of one batch, upload each alias's
  ciphertext as a separate request at an independent jittered offset. It would remove
  the *explicit* batch grouping at the origin, but it re-introduces per-request
  timing and, at the edge, same-IP-within-window grouping, and it complicates the
  all-or-nothing validation. Net-negative today, since the origin is already
  blind-trusted and IP-stripped. Worth revisiting only if the origin-grouping
  residual becomes a concrete concern.
- **Cover traffic.** Schedule cover republishes across unrelated aliases so any
  window holds many owners' writes (the analogue of the notify cover broadcast).
  Strongest against both vantage points, but it amplifies writes across the whole
  population. Worth it only if measurement shows the shipped queue leaves a
  meaningful residual.

Creation-time correlation (aliases minted close together, e.g. a public alias and a
Findable alias at onboarding) is a separate surface: it is mint-time, not the
republish/wake path this doc scopes, and staggering it fights first-use latency (a
new share link must work immediately). Out of scope here; revisit only if the threat
model is amended to cover mint-time.

## Honest limits (carried)

- The single batch makes the sibling grouping EXPLICIT to the origin (built trade,
  above): the origin sees N ciphertexts in one request. Accepted because the origin
  is blind-trusted, IP-stripped, and could already infer the grouping from the old
  same-instant burst. Phase A (per-alias jittered uploads) would remove even this;
  not built.
- The edge (Cloudflare) sees client IPs; the batch removes the per-write upload
  signal (one request, TLS-hidden contents), but the single upload's IP+timing is
  still edge-visible. Retention policy bounds it; it is not eliminated.
- Jittered apply delays status propagation by up to `RepublishWindow`; the window is
  a privacy/latency trade to tune, not a free win. The time-sensitive partner-notify
  ping is a separate, immediate path, so a positive result still reaches partners
  promptly while the cards decorrelate. This is a LATENCY limit only: a card may look
  stale for up to the window, but it is never reverted to an older value. The earlier
  concern (a deferred op applying out of order behind a newer write, or behind a
  revoke, and flipping the card back) is NOT carried, the `ApplyRepublish` guard
  resolves it. A queued snapshot is skipped once the alias has been written past the
  op's enqueue time, so the newest write always wins and a revoked card stays revoked.
- Decorrelation granularity is the janitor tick (`STI_JANITOR_INTERVAL`, default 1
  min): two ops jittered into the same tick apply in one drain pass, i.e. the same
  observable instant. So the window must span many ticks to keep that same-tick
  collision rare, which is why `RepublishWindow` defaults to 20 min (~20 slots, a
  given pair collides ~1/20) rather than a couple of minutes. Pushing the collision
  lower still means either a wider window (more staleness) or a dedicated faster
  drain (more infra); 20 min is the tuned balance, adjustable via the env var.

## Settled questions

The window length is a privacy/latency knob, now set to a 20 min default (above); it
trades same-tick collision against how stale a just-changed status looks to an
existing link-holder, and is tunable per deployment. The enqueue endpoint's
existence-uniform shape is settled: `handleRepublish` returns a uniform `202` for a
real and a non-existent alias alike, so existence is resolved only by the deferred,
write-token-gated apply, exactly as the direct alias write path already guarantees.

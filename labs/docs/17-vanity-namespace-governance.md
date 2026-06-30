# sti.care: Vanity Namespace Governance (v1 spec)

_The full governance spec Public link mode is gated on. [Reach and Access](16-reach-and-access.md)
describes the two-mode model (Private link / Public link) and the role of this namespace; this doc
makes the public-link namespace implementable: the directory data model, the resolve endpoint and
its handoff to the knock flow, the reserved + blocklist starter contents, the allocation lifecycle,
and the metadata + legal posture. **Status: Findable LAUNCHED at the F6 flip** (client
`FINDABLE_ENABLED` on, server `STI_FINDABLE_ENABLED` set on the box, a curated hate-only blocklist
in place); the **gate** items below are the bar that was met, kept as a record. It does not change
Private links; those use opaque ids and give immediate access._

---

## Why this doc

Public link mode is the one mode that needs a server-side `name -> aliasId` directory — the one
exception to philosophy principle 6's "no central identity index" rule, and explicitly an opt-in
exception with user consent. Because the directory is the only place the server holds anything
resembling an identity, the bar to turn it on is a written, reviewed governance spec, not a code
change alone. Doc 16 confirmed the shape; the two build-time OPENs it left (the resolve endpoint,
and the reserved/blocklist contents) are resolved here so Public link is buildable without reopening
a product decision.

This doc governs **only** the vanity namespace and its directory. It does not touch status, keys, the
card payload, or the knock/grant crypto, all of which are unchanged from Private links.

## What the directory is (and is not)

A single mapping, opt-in per user:

- **Stored:** `name -> aliasId`, plus the minimum to enforce allocation (a created-at timestamp and a
  `locked_until` for the post-release lock). The `name` is a chosen vanity handle; the `aliasId` is the
  same opaque id any link uses. **There is no owner/account column:** ownership is proven by holding the
  alias's write token, and `aliasId` is the only owning reference, so the directory cannot (and does not)
  group the aliases of one account.
- **Never stored:** the status, the AES key, the card, the owner's other aliases, read history, or any
  link from a name to a status. Resolving a name yields an opaque alias id and nothing more; the viewer
  must still knock and be granted, exactly as in Gated.
- **Existence is deliberately revealed.** Unlike opaque aliases (existence-uniform), a registered name
  is discoverable by design, that is the entire point of opting in. The cost is stated in doc 16's
  honest limits and surfaced to the user at registration (below).

## Charset, normalization, length (gate)

- Allowed: `[a-z0-9_]` only. Normalized to lowercase on input.
- **No Unicode.** This removes homoglyph / confusable attacks at the namespace level (no Cyrillic `а`,
  no zero-width joiners). A name is exactly the bytes it looks like.
- Length 3 to 30 characters.
- A name that does not match after normalization is rejected at registration with a clear error; the
  resolve endpoint only ever sees already-normalized input (it normalizes again, defensively).

## Availability, checked as you type

The owner learns whether a name is free **as they type, not on submit** (doc 31). Format and the
client-side reserved list are checked instantly; availability is a debounced lookup against the
existing resolve endpoint (`GET /u/{name}`: a `200` means taken, a `404` means free), rate-limited
like any resolve. So a name reads as available before the owner commits.

A name can be unusable for more than one reason (already taken, reserved, or blocked), and surfacing
which would leak namespace state, so the message is one line regardless: **"That name isn't
available. Try another."** ("isn't available", not "taken", since "taken" is only one of the
reasons.) Format errors (too short, bad characters) are their own specific, non-leaky messages.

## Allocation lifecycle (gate)

- **First-come-first-served.** A name is held by exactly one alias at a time.
- **Released after a 24-hour lock.** When the owning alias is revoked or the account is deleted, the
  name enters a 24-hour locked window during which it is unclaimable by anyone, then returns to the
  pool (first-come). The lock defeats automated watch-and-grab (seizing a freed name the instant it
  frees, to impersonate the prior holder) and leaves a window for a report to intervene before reuse.
  It does **not** reserve the name for the prior owner (a deleted account is gone); after the lock
  lapses the name is freely reclaimable by anyone.
- **No transfers, no marketplace.** A name cannot be handed to another account or sold; release +
  reclaim is the only path, and it is racy by design (first-come wins).
- **Registration is rate-limited (server-enforced).** Claims (`PUT /u/{name}`) carry a per-IP bucket and
  a single global bucket, the same two-layer shape resolve and report use: the per-IP cap slows one
  squatter, the global cap bounds a distributed land-grab across many IPs / fresh aliases. Over-limit is
  a visible `429` (a public act, nothing to hide). This is the real backstop behind the client-side
  per-account cap (above).
- **Handle caps, and where each is enforced.** Each public link has its own handle, claimed when the
  link is created in the share sheet, not at account creation.
  - **One active name per alias (server-enforced).** A claim is rejected if the requesting alias already
    holds a different active name, so an alias cannot hoard several names (e.g. confusable variants
    `robin` / `rob1n` all aimed at one card). This is the only cap the directory CAN enforce, because it
    proves alias ownership without learning the account. To change a name, release the old one first.
  - **Up to 5 handles per account (client-side only).** The blind directory never groups an account's
    aliases (that would be the cross-alias index doc 15 forbids), so the per-account total is **not**
    server-enforceable and is enforced in the client. A crafted client can therefore mint extra aliases
    and claim a name on each; the backstop against that is the registration **rate limit** below
    (per-IP plus a global bucket), not a hard per-account ceiling. Stated honestly: the namespace
    resists bulk land-grab by cost, not by an account quota.

## Reserved names + blocklist (gate; resolves doc 16 OPEN)

Two unclaimable sets, checked at registration after normalization. Both are starter lists, versioned
in the repo and grown by report-and-takedown; neither is exhaustive.

- **Reserved (operational / official-impersonation):** `admin`, `administrator`, `root`, `system`,
  `sys`, `official`, `staff`, `team`, `mod`, `moderator`, `support`, `help`, `helpdesk`, `contact`,
  `info`, `abuse`, `security`, `legal`, `privacy`, `billing`, `payments`, `api`, `app`, `www`, `mail`,
  `email`, `noreply`, `no_reply`, `sti`, `sticare`, `care`, `health`, `clinic`, `verify`, `verified`,
  `test`, `null`, `undefined`. (Brand + operational terms; prevents an account masquerading as the
  service or its staff.)
- **Blocklist (abuse / impersonation-prone):** slurs and harassment terms, and obvious
  authority-impersonation patterns (`*_official`, `the_real_*` style is **not** auto-blocked, see
  below). The seed list lives in the repo (not enumerated here to avoid a slur list in a design doc);
  it is reviewed with counsel and grown reactively.

Look-alike impersonation **within** the legal charset (`robin` vs `rob1n`) is possible and handled
**reactively** via report-and-takedown, not prevented. Advanced confusable detection is explicitly
deferred; attempting it pre-launch would gold-plate a v1 most users never hit.

## The resolve endpoint (gate; resolves doc 16 OPEN)

One read endpoint, whose entire job is name lookup. It keeps the server's role to "translate a name to
an opaque id"; everything after is the unchanged knock/grant path.

- **`GET /u/{name}`** -> `200 { aliasId }` if the normalized name is registered, else **`404`** (a
  bare not-found; no body, no hint). The server normalizes `{name}` again before lookup.
- The client then runs the **existing knock flow against `aliasId`** (`POST` a knock, the owner reviews
  and grants through the blind grant). The resolve step adds nothing to that flow; it only supplies the
  id a Direct/Gated link would have carried in its path.
- **The server never sees** the key, the status, or whether the knock was later answered beyond what
  Gated already exposes (doc 13's grant-slot linkability limit). Resolve and knock are separate
  requests, so a name lookup is not joined to a status read.
- **Existence is not uniform here, by design.** A `404` vs `200` reveals whether a name is registered;
  that is inherent to a findable namespace and is the opted-into cost. Opaque aliases keep their
  existence-uniform `GET /a/{id}` behavior unchanged; this endpoint is a separate path under `/u/`.
- **Rate limiting (gate):** per-IP and global rate limits on `/u/` to slow bulk enumeration/scraping of
  the namespace. Short human-chosen names are enumerable in principle; rate limiting raises the cost,
  it does not make the namespace private (stated honestly, not sold as protection it is not).
- **Resolve stays unauthenticated; enumeration is accepted.** We do not auth-gate `/u/` or otherwise
  try to hide the namespace. A scrape of the namespace yields a list of registered names (so, of
  passports that exist). This is **accepted** because registering is an explicit, informed opt-in: the
  registering user is told the harvest impact at registration (below) and chooses it. The mitigation is
  consent plus rate limiting, not secrecy. (Confirmed: the user making an informed choice is the control
  here, not a technical barrier.)

## Metadata discipline (gate)

Carried from doc 16, made concrete:

- **No read logging tied to a name.** Resolve requests are not logged in a way that builds a
  `name -> {who looked it up, when}` trail. Request logs are minimal and ephemeral (short retention,
  no name-keyed analytics).
- The decorrelation / cover-wake treatment (doc 13) **extends to named aliases**: a findable alias is
  republished and woken on the same jittered/batched schedule, so its named-ness does not make its
  timing a side channel.
- A vanity registration is **the** most identity-like datum the system holds; it is treated as
  sensitive consumer-health-adjacent data for policy (consent + retention limits) under MHMDA / GDPR /
  CCPA regardless of HIPAA scope.
- **Counsel posture (no lawyer required to launch conservatively).** Counsel is not imminent, so the
  operating default **is** the strictest interpretation: treat the registration as sensitive, minimize
  what is stored (`name -> aliasId` and nothing more), keep retention short, and gate it behind explicit
  consent. That conservative posture needs no lawyer to adopt; counsel would be needed only to **relax**
  it (longer retention, looser classification), which is not on the path to launch. So this does not
  block a conservative Findable launch, it only bounds how much we could later loosen.

## Consent + disclosure at registration (gate)

Registering a name is the moment the existence-uniform guarantee is voluntarily dropped, so it carries
an explicit, plain-language disclosure before the name is taken:

- "A name is **public and findable**. Anyone who knows or guesses it can see that this passport exists
  and ask to view it." (They still cannot see the status without a grant.)
- "Your name can be **found in bulk**, not just guessed one at a time. The list of names is scrapable,
  so registering reveals that this passport exists to anyone harvesting the namespace." (What is
  revealed is the name + that the passport exists, never the status.)
- "Releasing the alias frees the name; after a short lock, anyone can claim it."
- "Names are not unique to a person and we do not verify identity; someone may pick a similar name."

The disclosure is part of the registration flow, not buried in terms. No dark-pattern default: Findable
is never pre-selected (doc 16 keeps Direct the default; the onboarding Findable row stays disabled until
this ships).

## Report and takedown (gate; designed hands-free where it can be)

The takedown surface is smaller than it looks, which is what lets most of it run without a human. The
system verifies no identity, so there is no authoritative person to impersonate; the concrete harms
are (a) impersonating the **service or its staff** and (b) **slurs / abusive** names, both of which are
the reserved + blocklist sets, so both are rule-based and automatable. The residual case (one pseudonym
mimicking another pseudonym) carries low harm precisely because neither name is verified or
authoritative.

So the process is:

- **Intake is automated.** An in-app / web report form creates a report record; no human is needed to
  receive a report.
- **Objective violations are auto-actioned (hands-free).** A reported name that matches the reserved
  list or blocklist is auto-revoked and enters the 24-hour lock, no judgment call. The match is
  re-evaluated against the current lists every time a name is reported, so a name that a later
  list-growth disallows is auto-actioned on its next report (there is no autonomous background sweep;
  the report path, plus the admin endpoint, is the re-check).
- **Volume never auto-acts.** A pile of reports against a name does **not** free it on its own; that
  would weaponize false reports as a griefing tool. Only objective rule matches auto-act.
- **The subjective residual is a minimal, reversible review.** A name that is neither a rule match nor
  clearly fine is queued for a single one-click reviewer action (revoke -> lock, or dismiss). This is
  the one step that is not hands-free; it is kept rare by the "nothing authoritative to impersonate"
  property, and it is reversible (the name is locked, not instantly reissued).

A substantiated takedown does the same thing a release does: revoke the alias and put the name through
the 24-hour lock. No separate punitive state.

## The launch gate (checklist)

Findable mode ships only when all of the following are true:

1. Charset/normalization, length, and the allocation lifecycle (including the 24-hour release lock) are
   enforced server-side.
2. The reserved + blocklist starter lists exist in the repo and are enforced at registration, and a
   reported name is re-checked against the current lists, so later list-growth is enforced on the next
   report (not by a background sweep).
3. `GET /u/{name}` is implemented with uniform `404`, defensive normalization, and rate limiting.
4. Metadata discipline (no name-keyed read logs; decorrelation extends to named aliases) is in place
   and tested.
5. The registration consent disclosure ships with the flow, including the bulk-harvest impact.
6. The report-and-takedown path exists: automated intake, hands-free auto-action on rule matches, and
   the one-click reviewer step for the subjective residual (volume never auto-acts).
7. The conservative data posture (sensitive treatment, minimization, short retention, explicit consent)
   is in place. Counsel review is **not** a launch blocker; it is needed only to relax that posture.

All seven now hold, so the onboarding Findable option is enabled (the "Soon" state has been retired)
and a name can be claimed from Settings.

## Honest limits (carried)

- **Names are enumerable.** Short human-chosen strings can be guessed/scraped; rate limiting slows but
  does not prevent it. Findability is the feature, not a leak, but the namespace is not secret.
- **Within-charset impersonation is reactive.** `rob1n` for `robin` is caught by report, not prevented.
- **Existence is revealed by registering.** This departs from the opaque path's existence-uniformity;
  it is the opted-into cost, disclosed at registration.
- **Release is racy after the lock.** A freed name reopens first-come once its 24-hour lock lapses; the
  lock blocks instant automated grabs but does not reserve the name for the prior owner.
- **The per-account handle cap is client-side.** The blind directory cannot group an account's aliases,
  so "5 per account" is enforced in the client, not the server. The server enforces one active name per
  alias and rate-limits registration; bulk land-grab is resisted by cost, not an account quota.

## What this does not change

Private links are untouched: opaque ids, existence-uniform `GET /a/{id}`, the knock/grant crypto
(now used for public links only), and `vanity + live` staying off the menu entirely (it would put a
readable status on the server). This doc governs the opt-in `/u/` lookup path and the rules around
it; it removes nothing and changes no existing infrastructure.

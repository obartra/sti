# sti.care: Vanity Namespace Governance (v1 spec)

_New, June 22, 2026._

_The full governance spec Findable mode is gated on. [Reach and Access](16-reach-and-access.md)
confirmed the three modes and sketched this spec; this doc makes it implementable: the directory data
model, the resolve endpoint and its handoff to the knock flow, the reserved + blocklist starter
contents, the allocation lifecycle, and the metadata + legal posture. Findable mode does not launch
until everything marked **gate** below is in place. It does not change any other mode; Direct and Gated
ship and behave exactly as today._

---

## Why this doc

Findable (vanity + request) is the one mode that needs a server-side `name -> aliasId` directory, the
one amendment to philosophy principle 6 (no central identity index). Because the directory is the only
place the server holds anything resembling an identity, the bar to turn it on is a written, reviewed
governance spec, not a code change alone. Doc 16 confirmed the shape; the two build-time OPENs it left
(the resolve endpoint, and the reserved/blocklist contents) are resolved here so Findable is buildable
without reopening a product decision.

This doc governs **only** the vanity namespace and its directory. It does not touch status, keys, the
card payload, or the knock/grant crypto, all of which stay exactly as in Direct and Gated.

## What the directory is (and is not)

A single mapping, opt-in per user:

- **Stored:** `name -> aliasId`, plus the minimum to enforce allocation (a created-at timestamp for
  release ordering disputes, the owning account reference needed to release on deletion). The `name`
  is a chosen vanity handle; the `aliasId` is the same opaque id any link uses.
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

## Allocation lifecycle (gate)

- **First-come-first-served.** A name is held by exactly one alias at a time.
- **Released on alias deletion or revocation.** When the owning alias is revoked or the account is
  deleted, the name returns to the pool and can be claimed by anyone. No grace hold, no reservation.
- **No transfers, no marketplace.** A name cannot be handed to another account or sold; release +
  reclaim is the only path, and it is racy by design (first-come wins).
- **One name per alias** in v1. An account with several findable aliases registers a name per alias;
  the directory never groups them (that would be the cross-alias index doc 15 forbids).

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
  CCPA regardless of HIPAA scope. Design as if it binds; confirm specifics with counsel.

## Consent + disclosure at registration (gate)

Registering a name is the moment the existence-uniform guarantee is voluntarily dropped, so it carries
an explicit, plain-language disclosure before the name is taken:

- "A name is **public and findable**. Anyone who knows or guesses it can see that this passport exists
  and ask to view it." (They still cannot see the status without a grant.)
- "Releasing the alias frees the name for anyone to claim."
- "Names are not unique to a person and we do not verify identity; someone may pick a similar name."

The disclosure is part of the registration flow, not buried in terms. No dark-pattern default: Findable
is never pre-selected (doc 16 keeps Direct the default; the onboarding Findable row stays disabled until
this ships).

## The launch gate (checklist)

Findable mode ships only when all of the following are true:

1. Charset/normalization, length, and the allocation lifecycle are enforced server-side.
2. The reserved + blocklist starter lists exist in the repo and are enforced at registration.
3. `GET /u/{name}` is implemented with uniform `404`, defensive normalization, and rate limiting.
4. Metadata discipline (no name-keyed read logs; decorrelation extends to named aliases) is in place
   and tested.
5. The registration consent disclosure ships with the flow.
6. A report-and-takedown path exists (free the name + revoke on a substantiated impersonation report).
7. Counsel has reviewed the consent + retention posture.

Until all seven hold, the onboarding Findable option stays disabled (shown, with "Soon"), exactly as
it is today.

## Honest limits (carried)

- **Names are enumerable.** Short human-chosen strings can be guessed/scraped; rate limiting slows but
  does not prevent it. Findability is the feature, not a leak, but the namespace is not secret.
- **Within-charset impersonation is reactive.** `rob1n` for `robin` is caught by report, not prevented.
- **Existence is revealed by registering.** This departs from the opaque path's existence-uniformity;
  it is the opted-into cost, disclosed at registration.
- **Release is racy.** Freeing a name on deletion means someone else can immediately take it; there is
  no hold for the prior owner.

## What this does not change

Direct and Gated are untouched: opaque ids, existence-uniform `GET /a/{id}`, the knock/grant crypto,
and `vanity + live` staying removed entirely. This doc adds a gated, opt-in `/u/` lookup path and the
rules around it; it removes nothing and changes no existing mode.

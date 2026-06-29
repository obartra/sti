# sti.care: Reach and Access (sharing modes)

_New, June 21, 2026._

_How an alias is reached and what a viewer gets when they reach it, as three coupled modes that keep
the server unable to read a status in every configuration we offer. Builds on the knock/grant flow
([Contact Graph](13-contact-graph-and-notification.md)) and is orthogonal to the displayed face
([Per-alias Identity](15-per-alias-identity.md)). It revises the public/private framing in the
[Decisions log](02-decisions.md) and amends one philosophy principle (no central identity index);
those revisions are recorded as confirmed below._

---

## Why this doc

Sharing a passport is the product's distribution problem, and the current "public alias vs private
alias" framing bundles two independent questions that are clearer apart:

- **Reach (addressing):** how the alias is found. An opaque id (`/a/a7f3k9q2`, unguessable, not
  enumerable, server-blind) or a vanity URL (`/u/bigddaddy`, memorable, findable, requiring a
  server-side name directory).
- **Access (sharing):** what a viewer gets on arrival. Live (the key rides in the link, so any holder
  sees the status immediately) or request (the viewer can only knock; the owner approves through the
  blind grant, doc 13).

They are orthogonal, but their privacy cost is not. By coupling them deliberately we offer the reach
people need for real-world sharing without ever letting the server hold a readable status.

## The invariant this doc protects

**The server never holds a readable status, in any mode we offer.** The card (state, labels, route,
handle, avatar) is sealed client-side; the server holds `opaque_id -> ciphertext` of fixed size and
nothing else. The AES key is in the URL fragment (`#k=`, never sent to the server) or delivered
through the blind grant slot; it never reaches the server. Everything below is derived from keeping
this invariant true. It is the crown jewel; a mode that breaks it is not on the menu.

## The two axes, and the one poison corner

A vanity URL has no room for a 43-char key, so to resolve `/u/bigddaddy` the server must map the name
to the card and supply the key, which means it can read the status and now holds a `name -> status`
directory. There is no crypto escape: deriving the key from the name hands the key to the server too.
So of the four reach x access combinations, exactly one breaks the invariant:

| | **Live** (instant) | **Request** (knock -> grant) |
|---|---|---|
| **Opaque** | keyed link you hand someone; server blind | bare link; holder knocks; server blind |
| **Vanity** | findable, but the server **reads and directories your live status** | findable, yet status stays **blind** (delivered via the grant) |

Vanity + Live is the only cell where the server gains a readable status. Every other cell keeps it
out.

## Decision (confirmed): three coupled modes, never vanity + live

Expose the three safe cells; never offer the poison one.

1. **Direct (opaque + live).** Hand someone the keyed link (a DM, an in-person scan, a per-contact
   link). They get the status immediately. Trust comes from the channel: handing over the link is the
   decision. This is today's keyed-link / per-contact behavior, generalized. **Default mode.**

2. **Gated (opaque + request).** Post a link anyone can grab, but reaching it only lets them **knock**;
   the owner approves per viewer through the blind grant. This is today's knock-on-private behavior,
   kept as the "advertise a link but approve each viewer" middle ground.

3. **Findable (vanity + request).** Anyone can find the URL by name and put it in a bio, but reaching
   it only lets them ask; the owner approves through the same blind grant. This is the new addressing
   path, and the only one that needs a name directory.

`vanity + live` is **removed entirely**, not offered even as a flagged opt-in: it is the sole
configuration that makes a status readable by anyone who looks up the name, and builds a
`name -> status` index, a subpoena-and-scrape magnet for health data. (The server itself still
cannot read the status; the bytes are ciphertext. The harm is that the name resolves to an id
whose key is effectively public, so anyone who looks up the name can read it.) (Confirmed: remove,
do not keep as an opt-in.)

**The load-bearing inversion: access friction scales with reach.** A link you deliberately handed to
one person can be instant, because the hand-off is the trust act. A URL anyone can find must make them
ask, because anyone can find it. That is backwards from "public means open," and it is exactly what
keeps the readable-status corner off the menu.

## What each mode lets the server see

In all three, the server never sees the status or the key.

- **Direct (opaque + live):** an opaque id in the request path; never the key (fragment), never the
  status, never an identity. Same as today's keyed links.
- **Gated (opaque + request):** an opaque id, plus knock metadata (volume, the salted per-device
  `requesterHash`) and that a knock was answered (the grant-slot-linkability limit, doc 13). No status,
  no key, no identity.
- **Findable (vanity + request):** the above, plus a `name -> aliasId` directory entry so the name is
  discoverable. The name (and that someone registered one) is the only thing findable adds over
  Gated; the status stays as protected as any private alias's.

## Durations and revocation (confirmed)

Duration is a property of the link/capability, not a per-viewer timer.

- **v1 supports updatable per-link duration + immediate revoke.** The owner can extend or shorten a
  link's lifetime at any time (it is a stored expiry both the device and the server honor) and can
  revoke immediately (overwrite the payload to garbage, drop the record; the existing revoke path).
  Nothing is immutable.
- **Expiry is an absolute timestamp (epoch ms), so it can be sub-day.** Durations are presets the owner
  picks (e.g. 1 hour, 24 hours, 7 days, 30 days, or no expiry); the link's `expiresAt` is `now + the
  preset` at the moment it is set. One unit across share links and per-contact links.
- **Enforcement is server-side, and the device also sweeps.** AMENDS the earlier client-only stance.
  The server stores each alias's `expiresAt` and, once reached, answers reads with a decoy, the SAME
  uniform response a non-existent id gets, so an expired link stops resolving on time even if the
  owner's device never comes back online. The owner's device still sweeps (revoke + drop) on its next
  action, which frees the id and the local record. The server thus learns one non-identifying time
  value per alias (its expiry instant); we accept that small metadata exposure as the cost of links
  that reliably die when they say they will. The expiry is sent on the alias PUT (an `X-Expires-At`
  header) and changes only when the owner changes the duration; a badge-driven republish leaves it
  untouched.
- **Deferred:** true per-*viewer* durations (expiring one recipient of a shared link without affecting
  others). That needs per-viewer re-keying, which breaks the single fixed-size ciphertext; stated as a
  known limit, not built in v1.

## Principle-6 amendment: the vanity directory (confirmed)

Philosophy principle 6 says "no central identity index." Findable mode requires one, so this is a
deliberate, scoped amendment, not a side effect:

- The directory is **opt-in** (only users who choose a vanity name are listed) and holds **only
  `name -> aliasId`**, never status, never the key. The per-user opt-in bounds who is listed; the
  amendment is that the system may hold such an index at all.
- **Metadata discipline (strict, confirmed):** no server-side read logging tied to a vanity name;
  request logs minimal and ephemeral; the decorrelation / cover-wake treatment (doc 13) extends to
  named aliases. Treat a vanity registration itself as sensitive consumer-health data for policy
  (consent + retention limits) under MHMDA / GDPR / CCPA, regardless of HIPAA scope (confirm specifics
  with counsel; design as if it binds).

## Vanity namespace governance (v1 spec, confirmed)

The minimum required before findable mode ships:

- **Charset + normalization:** `[a-z0-9_]` only, normalized to lowercase. No Unicode, which removes
  homoglyph/confusable attacks at the namespace level. Length 3 to 30.
- **Allocation:** first-come-first-served. **Released on alias deletion or revocation**, into a
  24-hour lock before the name returns to the pool (the lock prevents instant re-grab of a just-freed
  name; see doc 17 for the allocation lifecycle). No transfers, no marketplace.
- **Reserved + blocklist:** admin/support/official-style terms and an impersonation/abuse blocklist are
  unclaimable.
- **Abuse handling:** look-alike impersonation within the charset is possible and handled **reactively**
  (report-and-takedown), not prevented. Advanced confusable detection is deferred.
- Findable mode does not launch until this is in place.

The full implementable spec, the directory data model, the resolve endpoint and its handoff to the
knock flow, the reserved + blocklist starter contents, and the launch-gate checklist, is
[Vanity Namespace Governance](17-vanity-namespace-governance.md).

## Reach without a directory (the cheaper paths, ship first)

These cover much of distribution without a name directory, and ship ahead of vanity:

- **QR code.** Encodes the full Direct (live) link, so it is scannable, instant, server-blind, and
  needs no typing or directory. Strong for image-capable profiles and in person. Limit: it does not
  help same-phone viewing (you cannot scan a QR on the screen you are looking at) or text-only bios.
- **Copy-paste of a Direct link.** Where a bio allows selecting text, a long live link pastes into a
  browser, instant, no directory. Limit: only where the platform allows copy.

Vanity exists for the case these do not cover: a viewer reading an address off a text bio on the same
phone, where the established behavior is typing a short `@handle` (as people already do for
IG/Snap/Telegram). That case is real enough to justify findable mode (confirmed), with QR shipping
first as the cheap instant path.

## The deliberate ceiling

There is intentionally no instant + *searchable* status. A user who wants their live status reachable
by a memorable, findable name cannot have it, because that is exactly vanity + live. But instant,
server-blind status sharing is **not** removed: it stays available through a posted Direct link or a
QR. So the ceiling is "no searchable address with instant status," not "no instant public status," a
narrower and cheaper limit than it first sounds, and a protective one stated honestly.

## Honest limits (carried, stated)

- **Direct links are forwardable.** Live-via-link means whoever holds the link sees the live status,
  including via a forward. Mitigated by per-link revocation and expiry, not per-viewer gating. "Direct"
  is not "only this person forever." (If you want per-viewer approval on a posted link, use Gated.)
- **Findable carries vanity's non-status costs.** Request-gating removes the status leak, but the name
  directory, revealed existence (you are listed by name), and within-charset impersonation remain.
- **Findable existence is not hidden.** Opaque aliases hide existence; a vanity name is discoverable by
  design. That is the point of opting in, but it departs from the existence-uniform guarantee the
  opaque path gives.
- **Client-enforced expiry lingers if the owner is offline** (above).

## Relationship to per-alias identity (doc 15)

Orthogonal. Doc 15 is the **face inside the card** (handle + avatar, cosmetic, client-side, unlinkable
by default). This doc is **reach + access** (how the alias is addressed and gated). A findable alias
will typically also opt into a recognizable face (you want to be found and recognized); a direct alias
typically stays anonymous. The choices are independent and each carries its own stated cost.

## What this revises (recorded as confirmed)

- **Doc 02 "two modes" (public vs private)** becomes three modes (Direct / Gated / Findable). Instant
  public-status is no longer the most-public option; the most public is findable-and-ask. Today's
  "public" (opaque + key-in-fragment) maps to Direct; today's "private/knock" maps to Gated; Findable
  is net-new. No migration: the app has no production accounts, so the share UI simply replaces the
  public/private toggle with the three-mode picker (breaking change, accepted).
- **Doc 13 knock-on-private** stays as Gated; the knock + grant machinery is unchanged, only which mode
  triggers it is named. Findable reuses the same grant path. The "forwarded private link generates
  knocks" caveat becomes "a forwarded Direct link grants live access" (see limits); choose Gated when
  per-viewer approval matters.
- **Philosophy principle 6** is amended for the opt-in, status-free vanity directory (above).

## Build implications (sketch; sequencing, not new decisions)

1. **QR** (Direct-link encoder + a scan entry point). No server surface, no directory. Ship first.
2. **Three-mode share UI** replacing the public/private toggle. Direct + Gated already exist in the
   store; this is mostly client wiring + copy.
3. **Updatable per-link duration UI** (extend/shorten + revoke-now) over the existing expiry/revoke
   paths.
4. **Findable mode (gated on the governance spec above):** a new server surface, a `name -> aliasId`
   directory (never the key) plus a vanity-resolve endpoint, with the strict metadata discipline. The
   knock + grant path is reused unchanged.

## Open (build-time details, not blocking the decision)

> **RESOLVED** (in [doc 17](17-vanity-namespace-governance.md)): the vanity-resolve endpoint shape and
> its handoff to the knock flow. `GET /u/{name}` returns the aliasId (or a bare 404), then the normal
> knock runs against that id, keeping the server's role to name lookup only.

> **RESOLVED** (in [doc 17](17-vanity-namespace-governance.md)): reserved-name and blocklist starter
> contents, versioned in the repo and grown by report-and-takedown.

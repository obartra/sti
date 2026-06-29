# sti.care: Reach and Access (sharing modes)

_How an alias is reached and what a viewer gets when they reach it. Two modes that keep the server
unable to read a status in every configuration we offer. Builds on the knock/grant flow
([Contact Graph](13-contact-graph-and-notification.md)) and per-alias identity
([Per-alias Identity](15-per-alias-identity.md)). It revises the public/private framing in the
[Decisions log](02-decisions.md); those revisions are recorded as confirmed below._

---

## Why this doc

Sharing a passport is the product's distribution problem. The earlier three-mode framing (Direct /
Gated / Findable) had one mode that was underused — Gated (opaque + request): you'd post a link
publicly but viewers had no findable name to look you up by. Collapsing to two cleaner modes:

- **Private link** (opaque id + live key) — for people you already know or encounter directly.
  Anyone with the keyed URL sees the status immediately. No directory entry, no knock.
- **Public link** (unique handle + `/u/` + knock) — for posting in a dating app bio or sharing
  publicly. Anyone who visits `sti.care/u/{handle}` can knock; the owner approves each viewer.
  Findable by design. Reuses the existing vanity namespace infrastructure.

## The invariant this doc protects

**The server never holds a readable status, in any mode we offer.** The card (state, labels, route,
handle, avatar) is sealed client-side; the server holds `opaque_id → ciphertext` of fixed size and
nothing else. The AES key is in the URL fragment (`#k=`, never sent to the server) for private
links, or delivered through the blind grant slot for public links; it never reaches the server.
Everything below is derived from keeping this invariant true.

## Two modes

| | **Private link** | **Public link** |
|---|---|---|
| **Reach** | Opaque id (`/a/a7f3k9q2`) | Human handle (`sti.care/u/bigdgrindr`) |
| **Access** | Live — key in URL, immediate | Request — viewer knocks, owner approves |
| **Directory** | None | Server `name → aliasId` table (vanity_name) |
| **Existence** | Hidden from anyone without the keyed URL | Disclosed to anyone who visits the handle |
| **Identity default** | Pseudonym derived from alias id | Recognizable handle set at link creation |
| **Cap per account** | No meaningful cap | 5 active public links |

### Private link (opaque + live)

Hand someone the keyed link — a DM, an in-person QR scan, a per-contact share. Anyone who holds
the keyed URL sees the status immediately. Trust comes from the channel: giving out the link is the
trust decision. **Default mode for new aliases.**

- **No server directory.** The server sees an opaque id. No `name → id` mapping exists for private
  links. Existence is hidden from anyone who does not hold the keyed URL.
- **Immediate access.** The AES key rides in the URL fragment; there is no knock step. The viewer
  sees the card on arrival.
- **Identity defaults to a pseudonym.** `pseudonymFor(aliasId)` gives a stable random-seeming
  handle + avatar for this link, unlinkable to the owner's other links. The owner can override to a
  recognizable face if they want.
- **Private links are forwardable.** Whoever holds the keyed URL sees the live status, including
  via a forward. Mitigated by per-link revocation and expiry, not per-viewer gating.

### Public link (handle + /u/ + knock)

Post or share a handle publicly — in a dating app bio, on a QR code, on a social profile. Anyone
who visits `sti.care/u/{handle}` can see the handle exists and knock (request to view). The owner
approves each viewer through the blind grant.

- **Server directory entry.** The server holds `name → aliasId` in the `vanity_name` table. This
  is the one index the server maintains beyond opaque-id-to-ciphertext, and it is an explicitly
  consented, opt-in decision with a disclosure at registration (doc 17).
- **Existence is disclosed.** A `GET /u/{handle}` returning `200 {aliasId}` reveals the handle is
  registered. That is the opted-into cost of being findable — disclosed before the name is claimed.
- **Knock for everyone.** There is no "public live" mode where a viewer sees the status without an
  explicit grant. Every visitor to a public link must knock and be approved. The blind-store
  invariant is unbroken: the server never sees the key or the card content.
- **Cap: 5 active public links per account.** One per real public context (e.g. "BigD" on Grindr,
  "David" on Tinder). Bounds server-side resource use (knock queues, grant slots) without affecting
  normal use. Private links have no meaningful cap.

`vanity + live` is **removed entirely**, not offered even as a flagged opt-in: it is the sole
configuration that makes a status readable by anyone who looks up the name, and builds a
`name -> status` index, a subpoena-and-scrape magnet for health data. (The server itself still
cannot read the status; the bytes are ciphertext. The harm is that the name resolves to an id
whose key is effectively public, so anyone who looks up the name can read it.) (Confirmed: remove,
do not keep as an opt-in.)

## Per-link identity (handle + avatar)

A link's handle and avatar are set in the share sheet at the moment the link is created or edited —
not at account creation. They travel in the encrypted card payload: the server never sees them;
only a viewer who holds the key (private link) or receives a grant (public link) does.

Handles are **intentionally per-link and decoupled from the owner's local display name.** The same
person might use "BigD" on a Grindr public link and "David" on a Tinder public link, each for a
distinct context. No default is seeded from the display name. Each link's identity is a conscious,
independent choice.

For **private links,** the default is the id-derived pseudonym — stable per alias, unlinkable
across aliases. The owner can set a recognizable handle/avatar if they want.

For **public links,** a recognizable handle is the point: viewers visiting `/u/{handle}` should
know who they are looking for.

## Local display name

At account creation, the owner chooses a name for the app to use when addressing them ("Here's
your status, Sam"). This name lives in the encrypted account blob and never reaches the server. It
does not seed link handles and is never visible to any viewer.

This is the one name-like field in the system, and it is purely owner-facing. The server never
holds it. It is consistent with philosophy principle 5 (the server is blind) and principle 6 (data
minimization).

## What each mode lets the server see

In both modes, the server never sees the status, the AES key, the handle, or the avatar.

- **Private link:** an opaque id in the request path; never the key (fragment), never the status,
  never an identity. Same exposure as today's keyed links.
- **Public link:** a `name → aliasId` mapping (the one directory entry); plus knock metadata
  (volume, the salted per-device `requesterHash`) and that a knock was answered (the grant-slot
  linkability limit, doc 13). No status, no key, no card content.

## Durations and revocation (confirmed, unchanged from June 21)

Duration is a property of the link/capability, not a per-viewer timer.

- **v1 supports updatable per-link duration + immediate revoke.** The owner can extend or shorten
  a link's lifetime at any time and can revoke immediately (overwrite the payload to garbage, drop
  the record). Nothing is immutable.
- **Expiry is an absolute timestamp (epoch ms), so it can be sub-day.** Durations are presets the
  owner picks (e.g. 1 hour, 24 hours, 7 days, 30 days, or no expiry); the link's `expiresAt` is
  `now + preset` at the moment it is set.
- **Enforcement is server-side, and the device also sweeps.** The server stores each alias's
  `expiresAt` and, once reached, answers reads with a decoy — the same uniform response a
  non-existent id gets. The owner's device sweeps (revoke + drop) on its next action.
- **Deferred:** true per-viewer durations (expiring one recipient without affecting others). That
  needs per-viewer re-keying, which breaks the single fixed-size ciphertext; stated as a known
  limit, not built in v1.

## Honest limits

- **Private links are forwardable.** (Covered above under Private link.)
- **Public links are findable by design.** The handle reveals existence to anyone who visits or
  guesses it. Short human-chosen handles can be scraped; rate limiting slows but does not prevent
  enumeration. This is the opted-into cost, disclosed at registration (doc 17).
- **Within-charset impersonation is reactive.** `rob1n` for `robin` is caught by report-and-
  takedown, not prevented at claim time. See doc 17 for the full governance spec.
- **Client-enforced expiry lingers if the owner is offline.** The server enforces expiry at serve
  time; the device sweep is belt-and-suspenders.
- **Local display name is lost with the account.** If the owner loses their keys and recovery
  phrase, the display name is gone along with everything else.

## Relationship to per-alias identity (doc 15)

Orthogonal. Doc 15 is the **face inside the card** (handle + avatar, cosmetic, client-side,
unlinkable by default). This doc is **reach + access** (how the alias is addressed and gated).
The choices are independent.

A public link will typically have a recognizable handle and avatar (you want viewers to know whose
passport they are requesting). A private link defaults to a pseudonym but can be made recognizable.

## What this revises (recorded as confirmed)

- **Three modes collapse to two.** Direct (opaque + live) becomes **Private link**. Findable
  (vanity + request) becomes **Public link**. The intermediate Gated mode (opaque + request) is
  removed: if you want viewers to knock and be approved, give them a findable handle; if you want
  immediate access, use a private link.
- **Public link cap: 5 per account.** Multiple public handles are allowed (up to 5), one per
  public context. Replaces the prior one-per-account limit.
- **Handle at link creation, not account creation.** Onboarding collects only a local display
  name (owner-facing, encrypted). Handles are set in the share sheet when a link is created.
- **Vanity namespace governance (doc 17) stays.** All existing vanity infrastructure — vanity_name
  table, /u/ endpoint, server-side validation, admin review queue, report-and-takedown, blocklist,
  `FindableName.tsx` component — is reused. Doc 17 is updated for the multi-handle model.
- **Doc 13 knock stays.** The knock + grant machinery is unchanged; it now applies to public links
  only (private links grant immediate access via the keyed URL).

## Build implications (sketch)

1. **Two-mode share UI** (Private link / Public link) with per-link identity step (handle + avatar)
   in the share sheet.
2. **Local display name** at account creation / onboarding (replaces any forced handle choice).
3. **Public link cap enforcement.** Reject creation past 5 active public links; surface remaining
   count in the share sheet.
4. **Blob upgrade:** `findable: FindableRegistration` (single, optional) →
   `findable: FindableRegistration[]` (array, capped at 5 at write time). Each entry carries its
   own handle + alias id. Bump the blob version.
5. **Updatable per-link duration UI** (extend/shorten + revoke-now) for both modes.
6. **QR** (private-link encoder + scan entry point for in-person sharing). No server surface.
7. **Existing vanity infrastructure stays unchanged:** vanity_name table, /u/ server endpoint,
   charset validation, reserved list, blocklist, admin review endpoints and panel, report intake,
   `FindableName.tsx` — all reused. No new server work for public links beyond the blob upgrade
   and the existing five-alias-per-account claim check.

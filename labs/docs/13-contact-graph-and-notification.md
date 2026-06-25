# sti.care: Contact Graph & Partner Notification

_New, June 20, 2026._

_The design doc for the contact graph (pairwise links and circles) and the partner-notification
loop that rides on it. It synthesizes the locked choices in the [Decisions log](02-decisions.md)
and [Design](03-design.md) into an implementable spec, reuses the blind-store primitives from
[Build & Deployment](10-build-backend-and-deployment.md), and records the six product decisions the
owner confirmed on 2026-06-20 (see "Decisions" below). Built in tested slices; nothing implemented
at the time of writing._

---

## Why this doc

Everything shipped so far is single-owner: a person mints a passport, shares a link, revokes it,
reviews knocks, deletes their account. The remaining value, and the reason the product exists, is
the **mutual-care loop**: people link with each other, and if someone tests positive their recent
contacts get an anonymous "go get tested" nudge. That loop is one tightly-coupled system. This doc
designs it end to end so it can be built in safe slices rather than guessed at piece by piece.

It honors a hard constraint from [Philosophy](01-philosophy.md): the server stays **blind**. It
learns no identities, no pairings, no group memberships, no statuses. It moves opaque bytes and
fires contentless wakes. Every readable fact lives in a key-derived encrypted blob on the device.

## What is already locked (this doc must not relitigate)

From the [Decisions log](02-decisions.md) and [Design](03-design.md):

- **Circles are a convenience layer over pairwise links**, not a live status feed and not a
  "clean club." Permanent or event-based. (02 §Circles)
- **Minimum group size ~5** for any group-level status communication; no counts, no leaderboards;
  joining, leaving, and skipping all look ordinary. The individual always controls their own
  disclosure; the group never overrides it. (02 §Circles, 03 §Circles)
- **Three link paths:** link-in-chat/paste (remote default), scan-to-autolink (in-person QR/NFC,
  mutual consent, shares an alias not the handle), capability handoff (remote persistent mutual).
  A scan **proposes** a link both sides confirm; it never silently binds. (02, 03 §Linking)
- **Visibility and revocation are per-token / per-capability. There is NO global access state.**
  What a viewer sees depends only on which token they hold. Leaving one path never touches another.
  (02, 03)
- **"Revoke" = no future reads, not "unsee."** Grants can be point-in-time, durational, or
  until-revoked. New links should default to a routine expiry (e.g. 30 days), not until-revoked.
  (02, 06)
- **Knock:** a link-holder who lands on gray-nothing requests access; the request is contentless
  and never names them. The owner **always reviews, never auto-grants**, via a quiet owner-pull
  indicator (no per-knock push). The requester only ever sees the one uniform confirmation; the
  status later silently resolves (granted) or stays gray-nothing (not granted or nonexistent,
  indistinguishable). No pending/granted/denied signal ever. (02, 03 §Knock) The owner-pull review
  and the indicator already shipped.
- **Partner notification is anonymous, contentless, batched, and delayed:** "a recent contact
  suggests getting tested," never who/when/what. Draft window (~30 min) the user edits or deletes
  freely; then the batch locks and is immutable. Two separate timing jobs: the user-facing draft
  window, and the server-side send cycle (never surfaced). (02, 03 §Partner notification)
- **The on-device blob holds the full contact graph** (per-link opaque notify-tokens, link dates,
  group membership), alias definitions, and visibility preferences. **The server holds** only
  `opaque_alias_id to ciphertext`, `hash(notify_token) to opaque routing endpoint`, push
  endpoints, the encrypted account blob, and a batched send-cycle queue. (03 §Data)
- **Honest limits:** targeted push reveals to the server which routing endpoints receive a ping
  until the cover-wake mitigation ships; notification anonymity is bounded by the recipient's own
  in-window contact count and degrades toward deanonymizing at one contact. Both are inherent and
  stated, not hidden. (02, 03, 10 §F)

## Decisions (confirmed 2026-06-20)

1. **Grant model: in-app Approve, via an end-to-end-encrypted grant slot (DECIDED 2026-06-20).**
   The owner gets an in-app "Approve" button on a knock, and approving silently delivers access to
   that knocker, with the server still blind (it never sees the key). Mechanism:
   - When a viewer knocks, the client generates a **per-knock ephemeral keypair** and sends its
     PUBLIC key with the knock (alongside the existing `requesterHash`); it keeps the private key
     locally, keyed by the alias id. The pubkey is ephemeral and names no one.
   - The owner's knock review returns the pending `{requesterHash, requesterPubKey}` requests (the
     owner is authed by the alias write token; today it returns only a count, so this extends it).
   - On **Approve**, the owner encrypts the alias's key TO the requester's pubkey (ECIES: an
     owner-side ephemeral ECDH to the requester pubkey, derive a symmetric key, seal the alias key)
     and writes the sealed blob to a **grant slot**, an alias-shaped blind id derived
     deterministically from `requesterHash` (so the requester can find it without the server linking
     them). The payload is `{ownerEphemeralPubKey, sealedAliasKey}`.
   - The requester **polls the grant slot** (existence-uniform, like any alias read), decrypts with
     its stored ephemeral private key, obtains the alias key, and resolves the real alias, so the
     status **silently resolves** exactly as the locked design requires. No granted/denied signal;
     a not-yet-granted or declined request just stays gray-nothing.
   - The server stores an opaque sealed blob at an opaque id and routes nothing readable; it never
     learns who knocked, who was approved, or the key. Decline = the owner does nothing (no slot is
     written; indistinguishable from not-yet-reviewed). Revoke later = the existing alias revoke.
   This is more surface than an out-of-band grant, but it is fully blind and is the chosen UX.

2. **Decorrelation cover-wake: full broadcast in v1 (DECIDED 2026-06-20).** When any real wake is due, the
   server fires a contentless wake to **every currently-registered push endpoint** inside a
   jittered window, so the woken set is the whole population rather than the recipients. Each woken
   client then polls its own blind notify-inbox (existence-uniform, see below); only a real
   recipient decrypts a ping, everyone else gets a decoy. With no user base yet a full broadcast is
   trivially cheap and maximally private; a sampled cover set is a later refinement if scale ever
   demands it. **This is the gate that lets notify/push turn on.**

3. **Notify-inbox as a blind channel (DECIDED 2026-06-20, new server surface).** Today the server has
   `notify_route` + `send_queue` + `push_endpoint`, but a contentless wake alone cannot tell a
   recipient "this one is for you" once cover-wakes go to everyone. So we add a per-contact
   **notify-inbox**: an opaque id holding an existence-uniform encrypted payload, addressed and
   read exactly like an alias (`GET` returns real-or-decoy fixed-size bytes; the client decrypts).
   A pairwise notify-token is the capability `{inbox_id, write_token, key}` for the contact's inbox,
   exchanged at link time. The sender writes an encrypted ping; the recipient, woken by the cover
   broadcast, polls their inbox and decrypts. The server never learns which inboxes hold a real
   ping versus a decoy.

4. **Circles are purely client-side bundles (DECIDED 2026-06-20, no new server surface).** A circle is a
   local list of pairwise links plus a shared display preference. Group status sharing reuses the
   per-member pairwise channels; the server never learns a group exists. The min-group-5 rule is a
   client-side hide floor: a member's status is shown to the circle only when the circle has >=5
   members, else it hides (never reveals). No group token, no membership on the server.

5. **New private links default to a 7-day expiry (DECIDED 2026-06-20).** A durational grant
   re-serves a freshly rotated payload until expiry; at expiry the client stops re-publishing and
   the link resolves to gray-nothing. The owner can choose until-revoked explicitly.

6. **scan-to-autolink auto-shares on link (DECIDED 2026-06-20).** A scan still proposes a link both
   sides confirm (it never silently binds), but on confirm it shares status both ways by default,
   for a fast in-person flow. The confirm step is where consent is given.

## Data model

**On device** (inside the encrypted account blob, schema-versioned, the client owns all of it):

```
contacts: [
  {
    id,                       // local opaque handle for this pairing
    label?,                   // owner's private nickname, never sent
    linkedOn,                 // epoch day
    expiresOn?,               // for durational grants
    // what THEY can see of me: a per-contact alias I publish my card to
    myAlias: { id, writeToken, key, isPublic: false },
    // how THEY notify ME: my OWN receiving inbox, minted fresh for THIS contact and
    // handed to them at link time. One inbox per contact (not one shared inbox), so
    // a recipient holding two of my links cannot tie them to one owner. I poll every
    // contact's myInbox to receive nudges.
    myInbox?: { inboxId, writeToken, key, routingToken },
    // how I notify THEM: their notify capability, given to me at link time. Carries
    // the routing token too, so I can both write a ping (inbox) and ask for a wake
    // (hash(routingToken)); absent until the exchange completes.
    theirNotify?: { inboxId, writeToken, key, routingToken },
  }
]
circles: [ { id, name, memberContactIds: [...], display } ]
```

There is no account-level notify inbox. The notify capability is minted **per
contact** at link time and stored as that contact's `myInbox`; it IS the
`theirNotify` the other side records. Two links from one owner therefore carry two
unrelated inbox ids and routing tokens, so a recipient who holds both learns
nothing tying them together.

Each contact gets **its own alias** (`myAlias`), so revoking one contact (overwrite that alias to
garbage, drop the record, exactly the existing revoke path) never affects another. This is the
locked per-token/no-global-access model made concrete. The shared "one alias per visibility" used
today stays for the public profile and casual link; per-contact aliases are minted only when you
link with a specific person.

**On the server** (all opaque, all reusing existing or alias-shaped storage):

- `alias` (exists): per-contact card ciphertext, fixed size, by opaque id, write-token gated.
- `notify_inbox` (**new**, alias-shaped): per-contact contentless-ping ciphertext, fixed size, by
  opaque id, write-token gated. Same existence-uniform read as `alias`. One row per pairing, so
  inbox ids never repeat across an owner's contacts.
- `notify_route` (exists): `hash(routingToken) to opaque push routing endpoint`, for the wake.
- `push_endpoint` (exists), `send_queue` (exists): the wake fan-out.

## Linking flows

**A. Link in chat / paste (remote default, fully buildable now).** The owner mints a per-contact
alias and a notify exchange, producing a one-tap link that carries the alias key and the owner's
inbox capability (so the contact can notify the owner back). The contact opens it, mints their own
side, and sends their link back (one tap if chat-integrated). Both sides now hold each other's
`myAlias` (to read status) and `theirNotify` (to notify). No server-visible pairing: each side just
published an alias and an inbox, indistinguishable from any other.

**B. scan-to-autolink (in-person QR/NFC).** Same exchange, but the two capabilities are swapped
device-to-device over a QR/NFC proximity gesture instead of a chat link. **Needs a real camera and
two devices to verify; the exchange logic is shared with path A.** Build the logic now, gate the
scan UI behind a real-device check.

**C. capability handoff (remote persistent mutual).** A convenience wrapper over A for an ongoing
mutual link; deferred until A is solid.

## Partner notification loop

1. **Report a positive** (already wired to owner state). The client composes a **draft batch**: the
   set of contacts to notify (default: contacts linked within the relevant window; the user adds,
   corrects, removes, or deletes the whole batch freely).
2. **Draft window (~30 min, one config constant).** Last-write-wins; the user is in full control.
3. **Lock.** The last draft becomes immutable. For each contact in the batch, the client writes an
   encrypted ping to that contact's `theirNotify` inbox, and POSTs `hash(routingToken)` to the
   server so it queues a wake. The ping is encrypted to the contact; the server sees only opaque
   inbox writes and opaque routing hashes.
4. **Send cycle (server-side, never surfaced).** The existing jittered `send_queue` drain fires the
   wakes. **With decorrelation on, the drain ALSO cover-wakes the whole push population**, so the
   real recipients are hidden in the broadcast.
5. **Recipient.** Woken (real or cover), the client polls EACH contact's `myInbox` (one inbox per
   contact, so a nudge from any of them is found): a real ping decrypts
   to "a recent contact suggests getting tested, here is where to test + PEP info"; a decoy or empty
   inbox decrypts to nothing and the app shows its normal state. Contentless throughout: never who,
   when, or what.

## Knock to grant (in-app Approve)

Builds on what shipped (the quiet indicator + contentless inbox entry) by adding the encrypted
grant slot from decision (1). Flow: viewer knocks (carrying an ephemeral pubkey, private key kept
locally) -> owner sees the request and taps **Approve** -> owner seals the alias key to the
requester's pubkey and writes it to the requester's grant slot -> requester polls the slot,
decrypts, and the status silently resolves. The server moves only opaque sealed bytes: it never
learns an identity, the alias key, or the card. Declining is doing nothing (no slot written),
indistinguishable from not-yet-reviewed; there is never a denied signal. (Metadata caveat in the
limits below: the server can tell that a knock was answered, just not by or for whom.)

## What is gated, and on what

- **notify + push stay OFF** behind `STI_NOTIFY_ENABLED` + configured VAPID keys until the
  decorrelation cover-wake (decision 2) is built and reviewed. The Web Push sender already exists
  (gated). Flipping on also needs the browser service worker + Push subscription, which need a real
  browser to verify, and the prod VAPID keys provisioned.
- **scan-to-autolink UI** ships behind a real-device verification, sharing logic with the chat-link
  path.
- Everything else (per-contact aliases, the notify-inbox channel, circles as client bundles, the
  draft/lock batch, the cover-wake drain) is headlessly testable against the live blind store and
  builds without hardware.

## Proposed build slices (each its own tested PR)

1. **Per-contact aliases** (data-model + mint/list/revoke a named link per contact, 7-day default
   expiry). Reuses the existing publish/revoke machinery; adds the contact records + a Connect-
   screen management UI.
2. **In-app grant** (knock carries an ephemeral pubkey; review returns pending pubkeys; Approve
   seals the alias key to the requester via the encrypted grant slot; requester polls + resolves).
   Reuses the alias-shaped blind slot; ECIES on the client. Headlessly testable end to end.
3. **Notify-inbox channel** (server `notify_inbox` alias-shaped table + handlers; client write/poll
   helpers; existence-uniform tests). No behavior change while gated.
4. **Decorrelation cover-wake** (drain broadcasts to all push endpoints in a jittered window;
   client uniform poll of its inbox). Go tests for the fan-out; this is the gate-opener.
5. **Draft/lock partner-notify batch** (client compose/edit/delete within the window; lock writes
   pings + queues wakes). Tested against the live store with the gate on in tests only.
   Built as the channel logic: each contact carries the owner's per-contact `myInbox` (minted at
   link time) and the contact's `theirNotify`; `composeNotifyDraft` seeds the in-window notifiable
   contacts and
   `lockNotifyDraft` writes a contentless ping to each plus a best-effort `notify(hash(routingToken))`.
   The capability EXCHANGE that fills in `theirNotify` (mutual link / scan) and the wake actually
   landing (push routing + the gate) are the later linking and slice-7 work; until then a contact
   has no `theirNotify` so the batch is empty in the running app, exactly as tests simulate it.
6. **Circles** (client-side bundles + min-group-5 hide floor + the Circles UI). No server surface.
   Built as account model v7 (`circles`, optional) + circle CRUD on the account manager (upsert
   normalizes members against current contacts; removing a contact strips it from every circle) +
   the floor logic: `circleMeetsFloor` and `visibleCircleStatuses`, which hide a circle entirely
   below five members (never a partial reveal). The Circles UI lands with the contact-status
   resolution it would display (the mutual-exchange work), so this slice is the tested data +
   privacy logic, not the screen.
7. **scan-to-autolink UI** (auto-share on confirm) + **browser service worker / Push subscription**
   (real-device verify), and **prod VAPID key provisioning**: the hardware-gated tail.

## Honest limits (carried, stated)

- One-contact deanonymization: if a recipient has exactly one in-window contact, a ping points at
  that contact. Inherent to partner notification; unfixable without not sending. Stated to users.
- Forwarded private link: still forwardable, so a stranger can knock; reviewed + contentless, so it
  only ever generates ignorable knocks, never status. Accepted. A contact INVITE link additionally
  carries the owner's PER-CONTACT notify capability (inbox + routing token) in the fragment, so a
  forwarded invite lets a stranger write that ONE inbox's ping and request a wake. Bounded and
  accepted: notify/push stays gated off until the cover-wake ships, the inbox holds one fixed-size
  ping, and the worst case is a spurious "a recent contact suggests testing" on the next poll.
  Because the inbox is per-contact, the blast radius is exactly that one pairing; the owner revokes
  it by dropping that contact (same trust boundary as the link channel itself), and no other
  contact's inbox is touched.
- Recipient-side sibling correlation (FIXED): the notify inbox is now per contact, so two of the
  owner's links held by one recipient carry unrelated inbox ids and routing tokens and cannot be
  tied to a single owner. The cost is N polls (one per contact) instead of one. Residual: when push
  is enabled, the owner registers each per-contact routing-token hash against the same Web Push
  subscription, so the SERVER can count an owner's routes (a contact-count metadata signal, never an
  identity). Unchanged by per-contact inboxes is the cover-broadcast, which still hides WHICH device
  a wake is for; push delivery stays gated off by default.
- A full-broadcast cover-wake scales with the push population; fine at current (zero) scale, and a
  sampled cover set is the documented later refinement. Two facets of the same limit: the drain
  delivers covers in bounded batches per pass (backpressure so one pass cannot block the loop), so a
  population beyond one batch is woken across several passes, and its tail can land past the jitter
  window. Cover wakes are mutually indistinguishable whenever they land, so this widens the smear
  rather than leaking; it folds into the sampled-cover-set refinement.
- A recipient with a notify route but no registered push subscription is absent from the broadcast
  population, so its real wake is dropped (nobody to wake). This is a missed wake, not a leak, and
  matches the pre-cover-wake drain, which also dropped a job with no subscription.
- Grant-slot linkability: a knock is `POST /knock/{aliasId}` carrying the requesterHash, so the
  server holds `(aliasId, requesterHash)` and can recompute the grant slot id and notice the owner's
  PUT to it. It therefore learns "this knock was answered", but nothing more (both values are opaque
  tokens, the key is ECIES-sealed, the card encrypted). Removing even this would need a secret the
  pre-grant requester does not share with the owner; accepted as a residual, not chased.
- Avatar viewer-correlation: the published card carries the owner's avatar (sealed, so invisible to
  the server). It is one value per account today, so a VIEWER holding two of an owner's links can
  correlate them by avatar. The account-wide handle correlates the same way; both the handle and the
  avatar are a real cross-alias correlation surface, not a residual to accept (the handle doing it too
  is the same bug, not a justification for the avatar). Tracked for removal by per-alias identity in
  [doc 15](15-per-alias-identity.md): id-derived unlinkable faces by default, the main identity an
  explicit opt-in.

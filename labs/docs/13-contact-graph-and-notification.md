# sti.care: Contact Graph & Partner Notification

_New, June 20, 2026._

_DRAFT for review. This is the design doc for the contact graph (pairwise links and circles) and
the partner-notification loop that rides on it. It synthesizes the locked choices in the
[Decisions log](02-decisions.md) and [Design](03-design.md) into an implementable spec, reuses the
blind-store primitives from [Build & Deployment](10-build-backend-and-deployment.md), and proposes
answers for the items those docs left open (every proposed answer is flagged **PROPOSED** so it can
be confirmed or changed before any code lands). Nothing here is built yet._

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

## Decisions this doc proposes (confirm before building)

1. **Grant model: out-of-band only, in v1 (PROPOSED).** A link carries its own decryption key
   (in the `#k=` fragment for public, handed alongside for private). You "grant" someone by
   sharing a keyed link with them. A knock on a forwarded or keyless link is reviewed by the owner,
   who responds in the real-world conversation ("send me a fresh link"), which the locked design
   already names as the confirmation channel. **We do NOT build an in-app channel that delivers a
   key to an anonymous remote knocker**, because there is no way to hand a key to an opaque
   requester hash without either the server brokering it (breaks blindness) or the requester
   exposing a public key the owner must fetch (a new identity surface). This keeps the model fully
   blind and is strictly simpler. Re-grant after revoke = mint and share a new keyed link.

2. **Decorrelation cover-wake: full broadcast in v1 (PROPOSED).** When any real wake is due, the
   server fires a contentless wake to **every currently-registered push endpoint** inside a
   jittered window, so the woken set is the whole population rather than the recipients. Each woken
   client then polls its own blind notify-inbox (existence-uniform, see below); only a real
   recipient decrypts a ping, everyone else gets a decoy. With no user base yet a full broadcast is
   trivially cheap and maximally private; a sampled cover set is a later refinement if scale ever
   demands it. **This is the gate that lets notify/push turn on.**

3. **Notify-inbox as a blind channel (PROPOSED, new server surface).** Today the server has
   `notify_route` + `send_queue` + `push_endpoint`, but a contentless wake alone cannot tell a
   recipient "this one is for you" once cover-wakes go to everyone. So we add a per-device
   **notify-inbox**: an opaque id holding an existence-uniform encrypted payload, addressed and
   read exactly like an alias (`GET` returns real-or-decoy fixed-size bytes; the client decrypts).
   A pairwise notify-token is the capability `{inbox_id, write_token, key}` for the contact's inbox,
   exchanged at link time. The sender writes an encrypted ping; the recipient, woken by the cover
   broadcast, polls their inbox and decrypts. The server never learns which inboxes hold a real
   ping versus a decoy.

4. **Circles are purely client-side bundles (PROPOSED, no new server surface).** A circle is a
   local list of pairwise links plus a shared display preference. Group status sharing reuses the
   per-member pairwise channels; the server never learns a group exists. The min-group-5 rule is a
   client-side hide floor: a member's status is shown to the circle only when the circle has >=5
   members, else it hides (never reveals). No group token, no membership on the server.

5. **New private links default to a 30-day expiry (PROPOSED).** Matches 06's "prefer routine
   expiry over until-revoked." A durational grant re-serves a freshly rotated payload until expiry;
   at expiry the client simply stops re-publishing, and the link resolves to gray-nothing. The
   owner can choose until-revoked explicitly.

6. **scan-to-autolink auto-share default: OFF (PROPOSED).** A scan proposes a link both confirm;
   the default is to link without auto-sharing status (each side opts in afterward), the least
   surprising and most consent-preserving default. (02 leaves this open.)

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
    // how I notify THEM: their inbox capability, given to me at link time
    theirNotify?: { inboxId, writeToken, key },
  }
]
myNotify: { inboxId, writeToken, key, routingToken }  // my own inbox + push routing
circles: [ { id, name, memberContactIds: [...], display } ]
```

Each contact gets **its own alias** (`myAlias`), so revoking one contact (overwrite that alias to
garbage, drop the record, exactly the existing revoke path) never affects another. This is the
locked per-token/no-global-access model made concrete. The shared "one alias per visibility" used
today stays for the public profile and casual link; per-contact aliases are minted only when you
link with a specific person.

**On the server** (all opaque, all reusing existing or alias-shaped storage):

- `alias` (exists): per-contact card ciphertext, fixed size, by opaque id, write-token gated.
- `notify_inbox` (**new**, alias-shaped): per-device contentless-ping ciphertext, fixed size, by
  opaque id, write-token gated. Same existence-uniform read as `alias`.
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
5. **Recipient.** Woken (real or cover), the client polls its `myNotify` inbox: a real ping decrypts
   to "a recent contact suggests getting tested, here is where to test + PEP info"; a decoy or empty
   inbox decrypts to nothing and the app shows its normal state. Contentless throughout: never who,
   when, or what.

## Knock to grant (model a)

Unchanged from what shipped, plus the explicit grant story: the owner sees the quiet knock
indicator + the contentless inbox entry. To grant, the owner mints a fresh per-contact keyed link
(path A) and shares it out of band. There is no in-app "approve this knocker" button that delivers
a key to an anonymous hash, by decision (1). A future revisit could add an authenticated-contact
grant once a contact already holds an inbox capability, but v1 does not need it.

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

1. **Per-contact aliases** (data-model + mint/list/revoke a named link per contact). Reuses the
   existing publish/revoke machinery; adds the contact records + a Connect-screen management UI.
2. **Notify-inbox channel** (server `notify_inbox` alias-shaped table + handlers; client write/poll
   helpers; existence-uniform tests). No behavior change while gated.
3. **Decorrelation cover-wake** (drain broadcasts to all push endpoints in a jittered window;
   client uniform poll of its inbox). Go tests for the fan-out; this is the gate-opener.
4. **Draft/lock partner-notify batch** (client compose/edit/delete within the window; lock writes
   pings + queues wakes). Tested against the live store with the gate on in tests only.
5. **Circles** (client-side bundles + min-group-5 hide floor + the Circles UI). No server surface.
6. **scan-to-autolink UI** + **browser service worker / Push subscription** (real-device verify),
   and **prod VAPID key provisioning**: the hardware-gated tail.

## Honest limits (carried, stated)

- One-contact deanonymization: if a recipient has exactly one in-window contact, a ping points at
  that contact. Inherent to partner notification; unfixable without not sending. Stated to users.
- Forwarded private link: still forwardable, so a stranger can knock; reviewed + contentless, so it
  only ever generates ignorable knocks, never status. Accepted.
- A full-broadcast cover-wake scales with the push population; fine at current (zero) scale, and a
  sampled cover set is the documented later refinement.

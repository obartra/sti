# 25 - In-person connect (the linkup)

## Status: PROPOSED (design)

Two people who are physically together connect in one shared gesture, instead of one
of them texting a link later. Internally this is the "linkup" from
[02-decisions §Linking](02-decisions.md); user-facing copy never says "linkup", it
says "connect" (doc 21 voice). The gesture does three things at once:

1. links the two aliases (each person now holds the other as a contact, two-way),
2. logs the encounter (a back-datable date) on each device, which is what later lets
   a positive report send the contentless "get tested" nudge to the right people,
3. shows a warm completion if both are blue, or a single neutral, non-alarming line
   if one is gray.

## Principle: status is the client's answer, never the server's

The blue/gray badge is computed on the OWNER's device and sealed into the card. The
server runs no badge logic and is authoritative for nothing about status (doc 10).
"Resolving a status" means a CLIENT got the card bytes and computed the badge
locally. The bytes normally come from `GET /a/{id}` over the internet, but they can
just as well arrive **in person over a QR code**, and the receiving client computes
the badge exactly the same way, fully offline. There is no "live status needs the
server": the internet only ever moves bytes.

This is why in-person connect can be fully offline, and why it is the MORE private
path, not a degraded one (see below).

## Offline-first: nothing needs the internet, and nothing touches the server

The canonical path is a **two-QR exchange**, and it requires no connection for either
person:

- A shows a code, B scans it (offline). B shows a code, A scans it (offline).
- Both now hold the connection, the encounter date, and (optionally) each other's
  current badge, stored locally in the encrypted account blob.
- Both sync whenever they next have signal, riding the existing offline-sync queue
  (doc 22, the device is the source of truth).

Because the bytes cross optically, **the pairing never reaches the server at all, not
even as ciphertext.** That is strictly stronger than our usual "stored encrypted"
guarantee: the server cannot see who connected because the bytes were never sent to
it. This is the new promise "we don't know who you're connected to", made true at the
strongest possible level, and connecting is the moment that makes the question
salient, so the promise ships with this feature.

Framing for the user is the opposite of "go online for a better experience":

> No signal? You can still connect. It saves to your phone and syncs when you are
> back online.

Online adds only convenience: it can re-fetch a live card later, syncs the new
connection sooner, and could support an optional one-scan variant. We auto-detect
connectivity with the signals we already use (the reconnect/catch-up path), but the
default is always the QR exchange, so there is no jarring mode switch.

## The connect screen (simultaneous show + scan, zero taps)

A single unified component does BOTH at once: it displays your QR code and runs the
camera simultaneously. Neither person picks a role, neither taps "switch", neither
waits for the other to go first.

The instruction is one line: **"Point cameras at each other's screens."**

- Both phones show their own QR prominently and run the scanner in the background.
- When B's camera catches A's code (or vice versa), that half completes silently.
- Each phone advances to its completion screen once its own scan lands, independent of
  the other. They're standing next to each other, so the pair can see both screens.
- The two halves complete in whichever order the cameras catch the codes.

This produces zero role permutations (no "show vs scan" state machine), zero taps,
and zero opportunity to get stuck in a "both showing / both scanning" dead end. The
only mode recovery needed is a camera-access denial (fallback: share via the existing
link flow).

Camera + QR are the only cross-platform, offline proximity primitive a web app has
(see "Native" below), and we already have a scanner (`QrScanner`) and QR generation
(the share sheet), so this reuses existing pieces.

## What crosses in the QR

NOT the 4096-byte server blob (too big to scan, and it is padded for existence-
uniformity on the server, which an in-person transfer does not need). Instead a
compact payload the owner's device builds from data it already holds:

- the alias id and the read key (or capability) for this connection,
- the per-contact inbox / notify capability, so the other side can later send a
  contentless nudge (per-contact, so two of your connections still cannot correlate
  you),
- an ephemeral grant public key (the existing knock/grant primitive),
- the encounter date (default today, back-datable),
- a compact, signed current-badge assertion (blue/gray + labels, signed by the alias
  key). Always included: status is shown at the moment of connecting. The snapshot is
  correct because the two people are standing in front of each other right now.

A few hundred bytes, comfortably inside a scannable QR.

## Completion: warm if both blue, neutral if one is gray (values)

This is the most values-sensitive surface in the product. Guardrails, non-negotiable:

- **Connecting is never conditional on status.** You can connect with someone who is
  gray. There is no "you must be blue to connect". The feature must not become the
  gatekeeper the product refuses to build (doc 01, doc 06 §10).
- **One-gray is a single neutral, non-alarming line**, never "this person is a risk".
  It reads as "there is free testing nearby", routing to care, never a verdict.
  (Most people connecting in person have already shared status earlier; this line is
  a reminder, not a revelation.)
- **Both-blue is a warm acknowledgement**, not a certificate or a "verified together"
  badge. It is a feeling, not a gate.
- Per-alias and revocable: you connect via one alias, your other links are untouched,
  and either side can later revoke (no future reads) and drop the contact.

## Reuse, not a parallel system

- `contactInvite` + `ingestContactReturn` already do a two-way completion (today via a
  link the other accepts); the offline two-QR path is the in-person, server-free
  variant of the same handshake.
- `aliasLink`, `QrScanner` (camera), the `Connect` screen, the share-sheet QR
  generator, the per-contact inboxes, and the offline-sync queue are all reused.
- New: the unified show/scan component, the completion screen, encounter-date capture,
  the compact in-person payload format, and wiring the link + encounter to land
  atomically and offline.

## How a NATIVE app would make this materially better (flag)

The web/PWA path above is a complete, private, universal floor. It is not a hack;
camera + QR is the correct primitive for a web app. But a native app (iOS/Android)
would improve the in-person moment in concrete ways the browser cannot reach, and we
should be honest that this is a real ceiling:

1. **Zero-scan proximity transfer.** Native Nearby Connections (Android) and
   MultipeerConnectivity / the AirDrop stack (Apple) let two phones discover each
   other and exchange data with a tap, or automatically on proximity, with no QR to
   display and scan. The web has no access to these. Native could make connecting
   one tap, or even prompt "someone nearby wants to connect" without either camera.
2. **NFC tap on BOTH platforms.** Web NFC (`NDEFReader`) is Chrome/Android only and
   absent on iOS. A native iOS app CAN use Core NFC, so a native build could offer
   tap-to-connect on iPhone too, not just Android. (In the PWA, NFC is at best an
   Android-only progressive enhancement.)
3. **Richer, larger, still-offline local channel.** Native multipeer gives a reliable
   encrypted peer-to-peer link with no signaling server, so the exchange is not capped
   at a QR's ~2 KB: full cards, multiple aliases, a richer handshake, all with zero
   internet and zero server. (Web WebRTC needs an internet signaling server to even
   start, so it does not give us offline.)
4. **Background proximity discovery.** Native BLE advertise/scan in the background
   could surface "you have a nearby connection" without opening the app or pointing a
   camera. This is privacy-sensitive and would be strictly opt-in, but it is only
   possible natively.
5. **Stronger on-device key storage.** Native key material in the Secure Enclave /
   StrongBox is harder to extract than an IndexedDB `CryptoKey`, hardening the whole
   on-device blob, not just this feature.
6. **More reliable contentless push.** Native APNs/FCM is more dependable than Web
   Push, which would also help the partner-notify delivery (Phase C), though that is
   tangential to connect.

Net: native would turn "show a code and scan it" into "tap, or it just happens", add
iOS NFC, allow a richer offline exchange, and harden key storage. None of it is a
prerequisite, the PWA path is fully functional and arguably more private (QR offline
touches nothing), but the seamlessness ceiling is real and worth recording.

## Decisions (resolved)

1. **Mechanism: two scans, fully offline, zero-server.** Two-QR exchange is canonical.
   One-scan + server-return is not offered; it buys one gesture at the cost of a
   server touch and an internet requirement for one party, which breaks the offline
   guarantee without sufficient gain.

2. **Status is shown at the moment of connecting.** That's the point. The badge
   assertion is always included in the QR payload (not optional). Connecting and
   sharing status are the same gesture.

3. **One-gray copy: neutral routing-to-care, no alarm.** The exact line belongs in a
   doc-21 copy pass before ship, but the direction is settled: "There is free testing
   nearby" tone, pointing to care resources. Not a verdict, not a risk signal.

## Phasing

- **v1:** offline two-QR exchange, simultaneous show+scan screen, status shown at
  completion (badge snapshot always in QR). Ship the "we don't know who you're
  connected to" promise with it.
- **Enhancement:** NFC tap on Android as a progressive enhancement over the scan.
- **Out of scope (recorded above):** the native-only seamless paths.

## Validation

- Unit + integration (real server) for the link + encounter + capability exchange and
  the offline-then-sync path.
- A story for the unified show/scan screen and the completion states.
- The camera/QR path needs a real-device manual pass before ship (cannot run
  headless).
- Values review of the one-gray line before it ships.

# sti.care: Cross-device sign-in

*The "how you add the passport to a second phone without typing the recovery phrase." The buildable
design behind the "add a device" flow in [Native apps and the app stores](26-native-apps-and-app-store.md)
section C. Pairs with [Data & storage](09-data-and-storage.md) (the account root is the account),
the [Decisions log](02-decisions.md) (the recovery phrase is the root, and a server-side reset is
impossible, both locked), [Device list and revocation](30-device-list-and-revocation.md)
(removing a phone later), [Contact graph & notification](13-contact-graph-and-notification.md) (the
QR scanner this reuses), and [Voice and tone](21-voice-and-tone.md) (the copy, illustrative until
drafted). Not legal advice.*

---

## In one line

The simplest cross-device path is the recovery phrase, which already gets a user onto a new phone with
no new code; pairing is optional polish on top. If we build it, it is **one scan**: the old phone shows
a code that carries the account, the new phone scans it once and mints its own local passkey. The code
is sensitive, in the same class as the recovery phrase, so it is shown briefly and deliberately to your
own phone. One constraint shapes the build: the live root is now a non-extractable key that cannot be
exported ([stay signed in](24-stay-signed-in.md)), so the old phone re-unlocks once at pairing time to
mint the code, and the **recovery phrase stays the primary cross-device path** that this only sits
beside.

## Three principles

1. **Move the root, not the passkey.** The account is the account root
   ([keyVault.ts](../../passport/src/auth/keyVault.ts); account id, blob key, and write tokens are all
   HKDF'd from it). A passkey is only a local credential whose PRF output wraps a copy of the root
   ([passkey.ts](../../passport/src/auth/passkey.ts)). So pairing never tries to copy a passkey across
   devices (it cannot cross platforms anyway). It moves the root once, and each phone then mints its
   **own** passkey over the same account.
2. **The code is sensitive, and we say so.** A one-scan transfer means the old phone shows the account
   in a QR, so whoever sees that QR can get in. That is the same sensitivity as the recovery phrase, and
   it is treated the same way: shown only on a deliberate tap, briefly, with a plain warning, pointed at
   your own new phone. We do not pretend the code is harmless.
3. **No server is involved in the transfer.** The handoff is phone-to-phone over the camera. Pairing
   adds **no** backend and writes nothing to `api.sti.care`; the new phone only reads its own account
   once, to confirm the code is real (section B).

---

## A. The two roles

- **The old phone (the authorizer).** It holds the account, but the live root is a non-extractable
  key it cannot read out ([stay signed in](24-stay-signed-in.md)). So to show the code it does a fresh
  unlock (its passkey, a Face ID prompt, or the recovery phrase), which is the one moment raw root
  bytes exist again; it mints the QR from those and drops them. Putting the reveal on the device that
  already holds the account, behind a deliberate unlock, is the same posture as showing the recovery
  phrase: the account never leaves the user's own trusted device except onto another of their own.
- **The new phone (the claimer).** Has nothing yet. It scans once, verifies the code actually opens a
  real account, and enrolls its own passkey.

## B. The flow: one scan

1. **Old phone:** from the profile, tap **"Add a device."** Because the live root cannot be exported,
   it first asks for a fresh unlock (passkey/Face ID, or the recovery phrase); that unlock briefly
   re-mints the raw root. It then shows a short warning and a QR carrying it (a versioned payload, for
   example `stcd1:` plus the base64url root), and drops the bytes again. Copy (voice to finalize):
   **"Show this only to your own new phone. Anyone who scans it can get into your account."**
2. **New phone:** choose **"Set up from another phone"** and scan the code with the existing scanner
   ([QrScanner.tsx](../../passport/src/ui/connect/QrScanner.tsx)).
3. **New phone finishes:** it derives the account id, opens the account blob from `GET /acct/{id}` to
   confirm the code is real (a wrong or garbled code fails closed at the GCM open, so nothing
   half-works), then enrolls its **own** local passkey over the root and lands signed in.

The old phone dismisses the code as soon as the new phone confirms, so the sensitive QR is on screen
only for the seconds it takes to scan.

## C. What is in the code, and why one scan is the right trade

The QR carries the account root itself, so a single scan is enough: no key exchange, no return
channel, no second scan. The cost is that the QR is a **bearer secret** for the moments it is shown,
exactly like the recovery phrase is whenever it is on screen. We accept that because:

- Pairing is a deliberate, in-person, one-off act between two phones the same person holds.
- The reveal is gated behind an explicit tap and a plain warning, and the code clears the instant the
  scan lands, so the exposure window is seconds, not a persistent artifact.
- The recovery phrase already sets the precedent: the product already asks the user to handle one
  account-equivalent secret carefully, and this is the same ask, more briefly.

## D. Fallbacks

- **No second device, or remote setup:** the recovery phrase is always the floor. "Set up from another
  phone" sits next to **"Use my recovery phrase."** Pairing needs both phones present, which is the
  intended in-person gesture; provisioning a phone you do not have next to another uses the phrase, the
  locked root (the decisions log). One honest lifecycle bound: the phrase recovers the account only
  while the server still holds its backup, and a backup untouched for two years is purged
  (`STI_ACCOUNT_INACTIVITY_TTL`, with the in-app retention notice on the Privacy screen); opening the
  app at any point resets that clock.
- **Same-vendor convenience:** within one ecosystem (all-Apple or all-Google), a platform-synced
  passkey can already carry unlock across the user's devices, so pairing is not even needed there. It
  does not cross iOS to Android, and it leans on PRF staying stable across synced copies, which is the
  slice-2 spike's job to confirm (doc 26); so it is a nicety on top, never the mechanism.
- **Native local transports (same ecosystem, optional polish):** on native, the QR can be replaced by a
  tapless local channel for the user's own two phones, MultipeerConnectivity on Apple or Nearby
  Connections on Android, or an NFC tap (doc 26 section E). The payload is the same **sealed** root,
  still minted behind the non-extractable re-unlock and carried only phone-to-phone, never to the
  server. It is same-ecosystem only (iOS to Android still uses the QR), so it is convenience, not the
  mechanism; the recovery phrase stays the primary cross-device path.

## E. Honest residuals

- **The code is a bearer secret while shown.** A photo or a shoulder-surf during the seconds the QR is
  up is enough to take the account, the same risk the recovery phrase carries. The warning, the
  deliberate tap, and the short on-screen window are the mitigations; there is no cryptographic gate,
  by choice, in exchange for one-scan simplicity.
- **A stolen, already-unlocked old phone** cannot just reveal the code: the live root is
  non-extractable, so minting the QR needs the fresh unlock (Face ID or the phrase), which a thief
  without the biometric or phrase cannot pass. That fresh-unlock gate is a real improvement the
  non-extractable key buys, not a residual to apologize for.
- **Remote provisioning is out of scope by design:** pairing is in-person; the recovery phrase covers
  the rest.

## F. Heavier alternatives we considered and did not take

Both of these remove the bearer-secret property but cost more than one in-person scan is worth, so they
are recorded here, not built:

- **Two-scan ephemeral exchange.** The new phone shows an ephemeral public key, the old phone seals the
  root to it and shows it back, so neither QR is a secret. It removes the bearer-secret risk entirely
  but needs **two scans** ("turn the phone around"), which is the friction we are explicitly avoiding.
- **One-scan relay.** The new phone shows an ephemeral public key, the old phone seals the root and
  hands it through a short-lived blind server mailbox, so it is one scan **and** no secret on screen.
  But it adds a backend endpoint group, its lifecycle, polling, and an online dependency. Not worth it
  for a one-off.

If the bearer-secret residual ever proves unacceptable, the two-scan ephemeral exchange is the
no-backend way to close it; that is the upgrade path.

## G. OAuth, considered and declined (recorded so it stays declined)

Using "sign in with Google/Apple" as a login or recovery factor was considered and is **declined**,
because it imports exactly what the product is built to exclude. The identity provider always learns
the relying party, so it would learn **that a person has an sti.care account at all**, the precise
metadata the blind server never keeps. OAuth also yields an identity assertion, not a key, so making
it actually unlock an account forces a **server-side key escrow**, which breaks both "we can't read
it" and the locked "a server-side reset is impossible by design" ([02-decisions.md](02-decisions.md)).
It would add a stable external identity linkable to an account, a new takeover surface (a phished or
subpoenaed provider account reaching someone's STI history), and an availability dependency. The
phrase plus one-scan pairing already deliver the convenience people want OAuth for, with none of those
costs, so OAuth is not worth its price here.

## H. Device list and revocation

Adding a phone is half the story; removing one is [doc 30](30-device-list-and-revocation.md), which
owns the device list and the key the re-key uses. The only hook here: enrollment also writes a device
registry entry (a label and a locally generated device public key, per doc 30 section A) into the
account blob, which rides the existing blob sync and 3-way merge, so two phones enrolling at once both
appear. That key is independent of this transfer, so the one-scan handoff and clean revocation do not
depend on each other.

## I. Build slices

1. **The code transfer.** Show-the-code on the old phone (behind the tap and warning), scan-and-open on
   the new phone, the versioned payload, and the fail-closed verify against the real account.
2. **Passkey enrollment on the new phone.** Reuse the existing passkey path so the new device gets its
   own local unlock.
3. **The device-registry entry** (doc 30): generate the device key pair at enrollment and write the
   label plus public key into the blob.

Platform-agnostic, so it can land on web first and the native apps inherit it.

## J. Testing and gates

- **Unit (Node, no DOM):** the payload encode/decode round-trips; a wrong or truncated code fails
  closed at the GCM open and never half-applies; the derived account id matches.
- **An invariant test:** pairing makes no write to `api.sti.care` during the handoff (it only reads
  `/acct/{id}` to verify), so it adds no backend and no new server-visible write.
- **The standard gates:** typecheck, lint, test, build, `build-storybook`, prettier, the Go suite, no
  em dashes (CLAUDE.md).

## K. Open questions

- **Show the code as a QR only, or also as text?** A QR is scan-only; a copyable text form is more
  flexible but a more durable bearer secret (clipboard, history). Recommend QR-only, matching the brief
  on-screen window.
- **Auto-dismiss timing.** How long the code stays up if no scan lands (a short timeout that hides it),
  so a forgotten open does not leave the account on screen.
- **Build no pairing at all for v1?** The recovery phrase already moves a user to a new phone with zero
  new code; pairing is optional polish. Phrase-only first, pairing later, is a legitimate way to keep
  v1 smallest.

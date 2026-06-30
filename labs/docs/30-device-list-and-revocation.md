# sti.care: Device list and revocation

*The "see the phones that can open your passport, and cut one off when you lose it, without a server
that knows who you are." Pairs with [Cross-device sign-in](27-cross-device-sign-in.md) (how a device
joins in the first place), [Data & storage](09-data-and-storage.md) (the key model this extends), the
[Decisions log](02-decisions.md) (the recovery phrase is the root, locked),
[Sibling-alias decorrelation](18-sibling-alias-decorrelation.md) (why a re-key must not land in a
burst), [Contact graph & notification](13-contact-graph-and-notification.md) (the notify and push
routing a removed device must lose), and [Voice and tone](21-voice-and-tone.md) (the copy, which is
illustrative until drafted). Not legal advice.*

---

## In one line

A user can see every phone that can open their passport and remove one they no longer trust. Removal
honestly means "cut off everything from here forward", not "reach into that phone and wipe it", and
the list lives inside the encrypted account so the blind server never learns how many devices a person
has or which.

## The hard truth, said first

The account is the root key, and the root is recoverable from the recovery phrase.
A phone that has held the root has already seen and cached whatever was synced to it, and **no design
can make it un-know that** (the same honest boundary as "we can't unsee what someone already saw" in
the promises). So device revocation is scoped precisely: it stops a removed device from making **future
changes**, receiving **future alerts**, reading **future updates**, and **adding more devices**. It
does not retract what already reached that phone. Saying that plainly is part of the feature.

## A. The device list: what it is and where it lives

A small registry kept **inside the encrypted account blob** (`/acct/{id}`), so it syncs to every
device and the server never sees it.

- **One entry per enrolled device:** a user-editable label ("my phone"), an added-at time, a last-seen
  time (refreshed on sync), a flag for "this device", and a **device public key the device generates at
  enrollment** (a long-lived key pair, private half kept local, needed for the re-key in section C). No
  PII; labels are chosen by the user.
- **Written at enrollment.** Joining via doc 27 appends an entry; the original phrase-origin device
  seeds the first one. The device key is generated locally at enrollment and is independent of how
  pairing transferred the root (doc 27 moves the root over the QR; this key exists only for
  revocation), so the simple one-scan handoff and clean revocation do not depend on each other.
- **The server stays blind to it.** The registry is plaintext only inside the E2EE blob. The server
  already sees some coarse device signal (a count of push registrations, write-token usage), and the
  registry does not widen that; it just gives the **user** a view the server still lacks.
- **It rides the blob machinery that already exists.** The account blob now has local-first caching, an
  `X-Version` optimistic-concurrency precondition, and a client-side 3-way merge on conflict
  ([offlineSync.ts](../../passport/src/store/offlineSync.ts),
  [blobMerge.ts](../../passport/src/store/blobMerge.ts)). A device registry is just another record set
  on that path, and the merge rules happen to be exactly what a device list wants: two phones that
  enroll while offline both appear (the merge adds both), and a removed entry stays removed (the merge's
  delete-wins rule never resurrects it).

## B. What a lost device can do (the threat being addressed)

A phone that holds the root can, until it is cut off: read state synced to it, overwrite or revoke
the owner's aliases and account (it holds write tokens), receive contentless alerts, and pair further
devices. Revocation has to take those away in the right order, strongest harm first.

## C. Two tiers of removal

Ship the simple tier first; it covers the most important harm. The full tier is a key-model change and
can follow.

### Tier 1 (lightweight, ships first): stop changes and alerts

- **Drop the device from the list** and **rotate the write tokens** (the account write token and the
  per-alias write tokens), then re-publish. The removed device can no longer overwrite, revoke, or
  delete anything: its tokens are dead. Dropping the entry is a blob edit, so the existing delete-wins
  merge keeps it gone across the other devices even if one of them was editing concurrently.
- **Tear down its routing:** remove its push registration and notify capability (doc 13), so it stops
  receiving alerts.
- **Honest limit, stated in the UI:** the removed device still holds the account key, so it can still
  **read state that was already synced to it** and could still read the blob until Tier 2. Tier 1 stops
  tampering and alerts, which is what a "lost phone" most urgently needs; it does not yet blind the
  device to future reads.

### Tier 2 (full cryptographic cut-off): re-key the account

A proper "this phone can no longer see anything new" requires rotating the key the blob is encrypted
under, so the removed device is locked out going forward. The shape:

- **Split the key model.** Keep the **account id stable**, derived from a stable **root** the recovery
  phrase produces (so the account never moves and the phrase always recovers it). Make the **blob key
  and write tokens** derive from a rotatable **epoch key**. Today's single root becomes root (stable)
  plus epoch key (rotatable). This is the one real change to [doc 09](09-data-and-storage.md) and wants
  its own crypto spec. Both keys follow the shipped lifecycle (raw bytes exist only at generation or
  derivation, then are imported as a non-extractable key and dropped, see
  [stay signed in](24-stay-signed-in.md)); a re-key generates fresh epoch-key bytes, seals the
  per-device envelopes from them, and drops them, so no long-lived key is ever exportable.
- **To remove a device:** mint a new epoch key, re-encrypt the blob and rotate write tokens under it,
  re-publish aliases, and hand the new epoch key to **each remaining device** through a per-device
  envelope (the epoch key sealed to that device's public key from the registry), stored at the
  server. The removed device gets **no** envelope, so it keeps an epoch key that now opens nothing; it
  can fetch the blob at the stable id but cannot read the new contents.
- **The phrase still works** because the root (from the phrase) wraps the current epoch key in a root
  envelope that is updated on each re-key. A removed device never had the root (pairing hands over the
  epoch key, never the phrase or root), which is exactly why it can be cut off while the phrase cannot.
- **A re-key is a whole-blob rewrite, not a field edit, so it sits outside the 3-way merge.** It still
  goes through the `X-Version` precondition like any write, but because it re-encrypts the entire blob
  under a new key it cannot be merged with a concurrent edit. So it must read the latest blob, apply the
  removal, re-key, and push against the current version; on a `409` it re-pulls and repeats rather than
  merging. Sequencing the re-key as read-newest-then-rewrite is the one place this design leans on the
  concurrency model rather than the merge.

## D. Who can remove a device

- **Removal is a root-level action.** Re-keying (Tier 2) and rotating the account write token (Tier 1)
  are powers of a device that can act as the account root, which a phrase-origin device is, and which
  any device becomes after the user re-enters the phrase. Paired devices hold the epoch key, enough to
  use the account day to day; the deliberate, destructive act of cutting another device off is gated to
  the root authority.
- **Losing every device** is the existing recovery path: re-enter the phrase on a new device, which
  re-establishes a root holder who can then prune the list.
- **A compromised phrase is a different, bigger event** (the root itself leaked), closer to "start a
  fresh account" than "remove a device"; it is noted in open questions, not solved here.

## E. Privacy and the blind server

- **The list is E2EE** (section A): the server cannot read it, so "how many devices, which, labeled
  what" stays invisible to it.
- **A re-key is server-visible activity** (a re-encrypted blob, rotated tokens, re-published aliases,
  new per-device envelopes). It **must drain through the existing jitter and cover path**
  ([doc 18](18-sibling-alias-decorrelation.md), [jitter.ts](../../passport/src/lib/jitter.ts)), never a
  synchronized burst, so "a pile of writes landed at once" does not become a correlation signal.
- **Routing teardown** (push, notify) on removal follows the same contentless discipline as the rest of
  doc 13; removing a registration reveals nothing about why.

## F. Honest residuals (named, not buried)

- **Cached data cannot be retracted.** Whatever reached the removed phone before removal stays on it.
  This is the irreducible E2EE truth and the UI says so rather than implying a remote wipe.
- **The window before removal.** Between losing a phone and removing it, that phone had full access.
- **Tier 1's read residual.** Until Tier 2 ships, a removed device can still read synced state; Tier 1
  is honest that it stops changes and alerts, not reads.
- **Phrase compromise is out of scope.** If the phrase itself leaks, device removal is not the remedy;
  that is the separate "rotate the root / new account" design (open questions).

## G. UX

- **A "your devices" list** in settings or privacy: each device with its label, "this device"
  highlighted, last-seen in plain relative time, and a quiet **"Remove"** per other device.
- **Plain, non-alarming labels** the user can edit, so the list is legible at a glance.
- **An honest confirm, not a scary one.** Illustrative copy (voice to finalize): "Remove this phone?
  It will stop getting alerts and can't change anything on your account. Anything already saved on it
  stays on it." Lead with the outcome, do not overpromise a remote wipe, do not stigmatize.
- **No nagging.** The list is there for a user who looks; it does not pester. Removal is reversible only
  by pairing the device again, which the confirm makes clear.

## H. Build slices

1. **The device list (read-only):** the registry in the blob, written at pairing (doc 27), and the
   settings screen. Valuable on its own, even before any removal exists.
2. **Tier 1 removal:** drop-from-list plus write-token rotation plus routing teardown, with the honest
   copy. Ships real protection with no key-model change.
3. **Tier 2 re-key:** the root/epoch split in doc 09, per-device envelopes, and the re-key on removal,
   draining through the decorrelation path. Its own crypto spec and PR.
4. **Tests:** the list round-trips in the blob and never appears in any server request; Tier 1 leaves a
   removed device's tokens rejected (extends the existing write-token-gate tests); Tier 2 leaves a
   removed device unable to read a re-keyed blob while every remaining device can; the re-key uses the
   jittered path. Plus the standard gates.

## I. Open questions

- **Phrase / root compromise.** The "the root itself leaked" scenario (rotate root, new account,
  migrate aliases) is related but distinct from removing a device; it deserves its own design rather
  than being bolted on here.
- **Last-seen granularity.** A precise last-seen is handy but is itself metadata on the device; decide
  how coarse it should be (a day, not a minute) so the list does not become a movement log if a blob
  ever leaks at rest.
- **Auto-pruning stale devices.** Whether a device unseen for a long time is offered for removal
  automatically, or always left to the user. Recommend always manual; an automatic cut-off could lock
  out a rarely-used second phone.
- **Label source.** Whether the joining device proposes its own label (from the OS device name, which
  can carry a person's name) or the user names it at pairing. Recommend the user names it, to keep an
  OS-supplied real name out of the blob.
- **Tier 1 only, for how long.** Whether Tier 1 is acceptable as the shipped state for a while (it
  leaves the read residual) or Tier 2 is a launch requirement for the native apps. A product call,
  flagged so it is deliberate.

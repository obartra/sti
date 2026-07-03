# Data & storage

*The plain answer to "should I trust this with my status?" What lives on your device, what
reaches our server, what we provably can't see, and the one place that isn't fully blind yet.
Pairs with the Design doc (mechanics) and Philosophy (why). Not legal advice.*

---

## In one line

Everything sensitive (diagnoses, dates, who you're linked to, your groups, your handles) lives
**on your device**, inside an encrypted blob whose key never reaches us. Our server stores
**ciphertext and opaque routing tokens, nothing else.** It can't read your status, and the stored
contact graph is unreadable to us. The one honest exception is partner-notification routing, which
isn't fully blind yet; it's called out in full below, not buried.

## What lives where

**On your device** (inside a passkey- or passphrase-derived encrypted blob; the key never leaves
the device):

- diagnoses, test and treatment dates;
- the badge and all clearance math (the 90-day clock, the per-site logic);
- your full contact graph: each link's opaque notify-token, link dates, group membership;
- your alias definitions: handle, avatar, privacy mode, validity/revocation;
- visibility preferences.

**On our server** (stored in the clear, but meaningless without your key):

| Store          | Shape                              | What it's for                                                                                                                                                              |
| -------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alias payloads | `opaque_alias_id → ciphertext`     | Serving a passport when someone opens a link. The id is random and meaningless, the only id we ever see. No handle, avatar, name, grouping, or even a public/private flag. |
| Account blob   | `opaque_account_id → ciphertext`   | Syncing your encrypted store across your own devices. Addressed by an opaque id derived from your key; holds nothing readable.                                              |
| Recovery envelope | `locator → ciphertext` | Getting back in from a new device that has only your recovery name and password (doc 32). The **locator** is a non-secret, owner-chosen public handle (doc 17); the ciphertext is your account root wrapped by a memory-hard KDF of your password. There is one table, keyed only by the locator: no factor or account-id column. The server holds only the wrapped bytes, never the password or anything derived from it, and answers a uniform fixed-size decoy on a miss, so whether a given name has an envelope stays hidden (an existence-uniform read). The passkey unlock wraps the same root too, but that wrap stays on your device and never becomes a server envelope. |
| Notify routing | `hash(notify_token) → opaque_handle` | Routing an anonymous "go get tested" nudge. The token is pairwise and was exchanged phone-to-phone, never through us.                                                     |
| Push endpoints | `opaque_handle → push subscription` | Waking a device with a contentless ping.                                                                                                                                   |
| Send queue     | batched outbound jobs              | Holding nudges briefly so cross-user batching hides timing. We trigger the wake; your device decides what (if anything) is shown.                                          |

Post-MVP and optional: SSO as a recovery anchor (`hash(sub) → ciphertext`) and an opt-in,
off-by-default, content-free email channel. Both still need your key to decrypt anything.

For a miss (an id that doesn't exist, or one you can't decrypt), the server returns
**decoy, ciphertext-shaped bytes**, uniform in both size and timing, so "can't read this" and
"doesn't exist" are indistinguishable.

## What we can, and can't, see

**We can see:** that an alias or a push endpoint exists, that some tokens got pinged, the size of
a ciphertext, and **aggregate operational telemetry about the service itself** (request rates and
latencies per endpoint, error and shed counts, queue depth, total row counts). The telemetry is
system-level only: it carries no id, IP, request body, or token, no per-request trail, and nothing
that links a request to a person or to another request. That's the list. (How that stays true is
spelled out in `12-observability-and-metrics.md`.)

**We can't see:** your social graph, your group membership, any diagnosis, any test or treatment
date, or how many contacts you have. None of it is readable without a key we never hold.

## The one honest caveat

Partner notification is the last place that isn't fully blind. The hard part is built and on by
default: a population-wide, contentless cover wake now fires on a fixed schedule (doc 18), whether
or not anyone reported. Because the schedule is constant, a quiet window emits the identical
broadcast as a busy one, and a real exposure ping rides the next scheduled wake as one anonymous
member of the population. That closes the old leak, where a naive *targeted* push would have let
our server see *which* handles receive a ping.

What remains is the other half of that design: a uniform "anything for me?" poll, so a recipient's
check for a waiting nudge looks identical to a non-recipient's. That poll isn't built yet. Until it
ships, the fetch after a wake can still tell who had something waiting, so "who got notified" is not
yet fully private, and we won't pretend otherwise. (See [Open questions](/docs/open-questions) and
the [Design doc](/docs/design).)

## Getting back in, and getting out

- **Recovery is on you, by design.** With no email or phone on file, a new device gets back in one
  of a few ways: a synced passkey, your @handle plus your password (doc 32), or the recovery
  passphrase shown once at signup, which is the backstop rather than the only way. We can't reset
  any of them; a server-side reset is impossible when the server can't read anything.
- **Deletion and export** is still an open item: a self-serve "delete everything tied to me" and
  "download what's held about me." Since we hold only ciphertext and opaque tokens, what's even
  meaningful to export is part of that question.

---

Mechanics for all of this live in the [Design doc](/docs/design); the rationale is in
[Philosophy](/docs/philosophy).

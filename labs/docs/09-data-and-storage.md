# Data & storage

*The plain answer to "should I trust this with my status?" What lives on your device, what
reaches our server, and what we provably can't see. Not legal advice.*

---

## In one line

Everything sensitive (diagnoses, dates, who you're linked to, your groups, your handles) lives
**on your device**, inside an encrypted blob whose key never reaches us. Our server stores
**ciphertext and opaque routing tokens, nothing else.** It can't read your status, and the stored
contact graph is unreadable to us. Even partner-notification routing, the hardest case, is now
blind: the server cannot tell who was notified. The one thing we do not offer yet is self-serve
deletion and export, called out in full below, not buried.

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
| Recovery envelope | `locator → ciphertext` | Getting back in from a new device that has only your recovery name and password. The **locator** is a non-secret, owner-chosen public handle; the ciphertext is your account root wrapped by a memory-hard KDF of your password. There is one table, keyed only by the locator: no factor or account-id column. The server holds only the wrapped bytes, never the password or anything derived from it, and answers a uniform fixed-size decoy on a miss, so whether a given name has an envelope stays hidden (an existence-uniform read). The passkey unlock wraps the same root too, but that wrap stays on your device and never becomes a server envelope. |
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
that links a request to a person or to another request. That's the list.

**We can't see:** your social graph, your group membership, any diagnosis, any test or treatment
date, or how many contacts you have. None of it is readable without a key we never hold.

## Partner notification stays blind

Partner notification is the hardest thing to keep private, so here is exactly how it holds. When
someone reports a positive, the people they were linked with get a contentless "go get tested"
nudge, and the server has to route it without learning who received it.

Two things make that hold. First, a population-wide, contentless cover wake fires on a fixed
schedule whether or not anyone reported, so a quiet window emits the identical broadcast as a busy
one, and a real nudge rides the next scheduled wake as one anonymous member of the population.
Second, every device checks for a waiting nudge on the same uniform cadence and reads it without
writing anything back, so a recipient's check is byte- and timing-identical to a non-recipient's.
Together they close the leak a naive *targeted* push would have opened, where the server could see
*which* handles received a nudge.

What the server still sees is only that nudges are enqueued at all, never who they reach.

## Getting back in, and getting out

- **Recovery is on you, by design.** With no email or phone on file, a new device gets back in one
  of a few ways: a synced passkey, your @handle plus your password, or the recovery
  passphrase shown once at signup, which is the backstop rather than the only way. We can't reset
  any of them; a server-side reset is impossible when the server can't read anything.
- **Deletion and export** is still an open item: a self-serve "delete everything tied to me" and
  "download what's held about me." Since we hold only ciphertext and opaque tokens, what's even
  meaningful to export is part of that question.

# 32 - Account recovery and unlock

## Status: APPROVED; building slice by slice (the plan at the end tracks what is built)

How a person keeps access to their account across devices and over time, and how an
optional, memorable password can fit without weakening the blind store. This doc owns
the recovery/unlock factor model. It builds on [24-stay-signed-in](24-stay-signed-in.md)
(the on-device resumable session) and does not change the server boundary in
[10-build-backend-and-deployment](10-build-backend-and-deployment.md): the server
still holds only ciphertext.

## The problem

Today the **recovery phrase is the single root secret**: phrase derives the root key,
and the root key derives the account id, the blob-encryption key, and the write token.
That is cryptographically excellent (the phrase is high-entropy, so the derived,
server-visible account id leaks nothing and cannot be reversed), but it has one real
cost: the phrase is the *only* durable way onto a new device, and a high-entropy token
is easy to lose. The thing we most want to avoid is a person losing access and feeling
forced to start a new account.

The obvious fix, "let people use a memorable password instead," is a trap if done the
obvious way, because the phrase's entropy is load-bearing. If a human password were the
root, the server-visible account id would become an **offline cracking oracle**: an
attacker (or the server operator) guesses the password, runs the same derivation, and
compares against the stored id, no ciphertext needed. A strength meter raises the floor
but cannot close that gap, because meters measure heuristics, not real entropy, and a
"strong" human password is still far below a random token. So a password can only be
safe if **nothing the server can see is derived from it**.

## The model: the phrase-derived root key, wrapped by each factor

This is mostly the model that already ships (see
[24-stay-signed-in](24-stay-signed-in.md)): today the phrase derives the root key, the
account id / blob key / write token derive from that root key, and the **passkey already
wraps the root key** so a device can unlock without re-typing the phrase. That is already
an envelope around a high-entropy root. The change here is small: add a **password
envelope** alongside the passkey one, and name the pattern.

So, deliberately NOT a redesign:

- The **root key stays derived from the recovery phrase** (the existing PBKDF2 path), and
  the **account id keeps deriving from that root key, exactly as today**. This matters for
  two reasons: it keeps the server-visible account id a function of the high-entropy
  phrase and **never of the password** (so the always-present account id is not a
  password-cracking oracle), and it means **existing accounts need no migration** (their
  id derivation is unchanged).
- Each enabled **factor encrypts its own copy of the root key** (an "envelope"); a device
  opens any one envelope and recovers the root key.

(A fully random root key, with the phrase demoted to just-another-envelope, is a cleaner
separation that would let the phrase rotate without changing the account id, but it
forces a migration of every existing account, so it is a possible future step, not the
default.)

Factors:

- **Recovery phrase** - derives the root key and is the high-entropy, unbreakable
  backstop. Always present.
- **Passkey / biometric** - wraps the root key per device (biometrics are not a separate
  factor; they gate the passkey). Already shipped. Synced passkeys (platform keychains)
  already give cross-device continuity within one ecosystem for free.
- **Password (opt-in)** - a memory-hard KDF of the password (Argon2id, per-account
  random salt, a deliberately high cost) wraps the root key. Its wrapped-key envelope
  is stored server-side as ciphertext, so it works on any device: fetch the envelope,
  unwrap with the password, recover the root key. This is the memorable, cross-device path
  the product wants, and it is the same wrap pattern the passkey already uses, just
  stored server-side and keyed by a password instead of a passkey.

Because the account id derives from the phrase-derived root key and **never from the
password**, adding a password introduces no oracle on the always-present account id. The
one thing an attacker can attack is a **stolen password envelope** itself, which is the
weakest-link cost named next, not a new derivation oracle.

## The tradeoff to accept on purpose

Multi-factor *unlock* is an OR: opening any envelope yields the root key, so the account
is only as strong as its **weakest enabled factor**. That is inherent to convenient
recovery, not a flaw. It means:

- The phrase and passkey envelopes stay unbreakable.
- A password envelope is as strong as the password plus the KDF cost. An attacker who
  steals that one envelope from the server can attack it offline.

So a password envelope is acceptable only behind a **strict strength gate** (reject
weak passwords, not merely score them) and a high Argon2id cost. The gate is not
optional polish; it is the thing holding the floor for everyone who turns the password
on. For a sexual-health product, where a breach is severe, the bar should be high and
the copy honest: the password is a convenience, **not the equal of the phrase**.

## What stays unchanged

- The server holds only ciphertext (the blob, plus now per-factor wrapped-key
  envelopes, which are themselves ciphertext) and minimal routing data. It learns no
  secret and gains no oracle.
- The phrase remains the high-entropy backstop and is always present, so a forgotten
  password never strands the account.
- On-device resume ([24-stay-signed-in](24-stay-signed-in.md)) is unchanged: the
  resumable root key still lives as a non-extractable key in IndexedDB.

## Continuity, the actual goal

Losing the account is the failure mode to design out. Beyond the envelope model:

- **Lean on synced passkeys** for same-ecosystem "I got a new phone" continuity; the
  phrase and password cover the cross-ecosystem and lost-device cases.
- **Make the phrase hard to lose**: prompt to save it to the OS keychain / password
  manager at creation, and let the owner re-view it from Settings.
- **Register more than one factor up front**, so losing any single one never strands
  the owner.

There is a real tension: more unlock paths make the account harder to lose but enlarge
the attack surface and lower the weakest-link strength; fewer, stronger factors are
safer but easier to get locked out of. This product sits deliberately toward strong
factors: synced passkey plus phrase as the core, password as an opt-in convenience
behind a strict gate, account id never derived from the password.

## Keeping the recovery factor memorized (rehearsal, not rotation)

The real failure mode is forgetting the thing that gets you back on a new device. Two
ideas, and where they land:

- **Periodic rehearsal (yes, gently).** Borrowing the spirit of Signal's PIN reminder:
  if a password is set, occasionally ask the person to type it (skippable for a while,
  then a firmer prompt) so the muscle memory stays. The same gentle rehearsal suits the
  phrase ("can you still find it?"). The key difference from Signal: because the phrase
  is always the backstop, forgetting the password is not terminal, so this is a
  **recovery rehearsal, not a lockout**. It nudges, it does not strand: it never blocks
  use, skipping never locks the account, and a wrong answer just dismisses. Biometrics
  still handle everyday unlock between rehearsals, so this is rare, not a tax on each open.
- **A once-a-year reminder (fine, with one line drawn).** A single, simple
  notification shown only if a password is set and unchanged for 365 days, suggesting a
  refresh, is harmless and worth having. The one line to hold: it is a **reminder, not
  a forced reset**. Mandatory scheduled rotation is the actual anti-pattern (it pushes
  people to weaker, predictable increments; NIST guidance is against it), so the
  yearly nudge must stay dismissible and never block use. Also rotate **on a signal of
  compromise**. Rotating just re-wraps a fresh envelope; the root key and account id
  never change.

## Where this is managed

Factors are added, viewed, and removed in **Settings** (see
[31-app-shape](31-app-shape.md)): re-view the phrase, turn an optional password on or
off (which mints or drops its envelope), and see which unlock methods are active.
Changing the password re-wraps a fresh envelope; it never re-keys the root key, so links
and the account id are untouched.

## Honesty (user-facing copy)

Per [21-voice-and-tone](21-voice-and-tone.md), state what is protected, never how it
could be attacked, and never overclaim. A password's copy must not imply it is as
strong as the phrase; it should read as a convenient way back in, with the phrase named
as the real backstop. The strength gate's message says plainly that a weak password is
not accepted, without lecturing.

## The cross-device locator (the real crux to resolve)

The envelope model glosses one hard problem: on a **new device with only the password**,
how does the client find which envelope to fetch? The account id derives from the
phrase, which the person does not have on the new device, and it must **never** derive
from the password (that is the oracle this whole doc avoids). A password alone therefore
cannot name its own envelope.

The resolution is a **non-secret recovery locator**, chosen by the owner when they turn
the password on, distinct from the password:

- The locator **names** the envelope; the password **opens** it. Cross-device unlock is
  "locator + password", two memorable things, not one. The honest framing in copy is
  "your recovery name and password", with the phrase still the real backstop.
- The locator is **not a secret and not the account id.** It is a server-side lookup key
  mapping `locator -> { envelope ciphertext, kdf params, salt }`. Knowing it lets someone
  *fetch an envelope ciphertext* (rate-limited, below), never *open* it: the password +
  Argon2id cost is the only thing protecting the wrapped root. This is the same
  weakest-link cost already named ("an attacker who steals that one envelope can attack
  it offline"), with the locator deciding *which* envelope, not weakening it.
- The locator must not be a password-derived value (that would re-introduce a
  password->server-visible-value oracle). It is owner-chosen, like a username. A person
  who already holds a public findable name (doc 17) may reuse it as the locator; everyone
  else picks a recovery name when enabling the password. It is validated for shape only
  (charset/length), never required to be unique to a human, and reveals nothing.
- **No locator collision oracle:** a fetch returns a uniform "here is an envelope-shaped
  blob" whether or not one exists (a decoy when absent), so the lookup is existence-
  uniform like alias reads, and does not confirm "an account uses recovery name X".

This keeps the invariant intact: nothing the server can see is derived from the password,
and the always-present account id stays a function of the high-entropy phrase only.

## Resolved decisions (pending sign-off)

- **No password-only accounts.** The phrase always exists as the backstop, so a forgotten
  password is never terminal. A password is strictly an *additional* envelope, opt-in, and
  the account id keeps deriving from the phrase-derived root only. (Resolves the
  password-only question: no.)
- **Drop the local PIN.** Biometrics / passkey already cover everyday device unlock, and a
  device-only PIN adds attack surface for little gain. Not built. It does not affect the
  envelope model, so it can be revisited later for a no-biometrics device if a real need
  appears. (Resolves the local-PIN question: drop.)
- **KDF: Argon2id, versioned, measured.** A WASM Argon2id with a per-account random 16-byte
  salt and a 32-byte output. Starting parameters, to be confirmed by measuring on a
  low-end target phone before launch: **memory 64 MiB, iterations (time cost) 3,
  parallelism 1** (a deliberately high, ~sub-second-on-a-phone cost). The exact params are
  **stored with the envelope** (a small versioned record), so an old envelope still opens
  with its original cost and a re-wrap can raise the cost later without stranding anyone.
  These are security constants: raise them deliberately, never silently.
- **Strength gate: reject, do not score.** A weak password is refused, not graded. The
  gate is a hard floor: a minimum length **and** an estimator threshold (a bundled
  zxcvbn-style estimate at its strongest bucket, run fully client-side so no candidate
  ever leaves the device) **and** a bundled common-password/breach wordlist check (local,
  never an online lookup that would leak the candidate). The copy says plainly that a weak
  password is not accepted, without lecturing and without describing the attack
  (doc 21). This gate is load-bearing, not polish: it holds the floor for everyone who
  turns the password on.
- **Envelope storage + rate-limiting.** The server stores per-account, per-factor
  wrapped-key envelopes as opaque records keyed by the locator: `{ locator, factor,
  version, kdfParams, salt, wrappedRoot }`. Everything is opaque ciphertext except
  `kdfParams` + `salt` (needed to derive the unwrap key; a salt is not a secret).
  Fetching an envelope is **rate-limited per IP** (and by a global bucket) like a
  sensitive read and returns a uniform, fixed-size envelope-shaped response (real or a
  deterministic decoy on a miss), so the store is not a freely harvestable target and
  not an existence oracle. Writing/replacing an envelope (enable, change, disable) is
  authorized by the account's write token (derived from the phrase-root the owner
  already holds when they manage factors in Settings).

  **The write and delete paths are existence-uniform too.** A write against a locator
  already held under a different token is a silent no-op (never an overwrite, never a
  distinguishing error), and a delete with a non-matching token or a missing locator is
  likewise a uniform success. So neither the write nor the delete path confirms whether
  a locator is taken, the complement of the decoy-uniform read. The cost is that a
  genuine locator collision is not reported at set-time by the server; instead the owner
  detects it **client-side** by fetching the just-written envelope and confirming their
  own password opens it (only they can), and picks another recovery name if it does not.
  The phrase remains the backstop, so a mis-set recovery name is never account-ending.

## Implementation plan (slices)

1. **Crypto: the password envelope.** _Built._ `wrapPasswordEnvelope(root, password,
   params) -> { params, salt, wrappedRoot }` and its inverse in `auth/passwordEnvelope.ts`,
   mirroring `auth/keyVault.ts`'s `wrapRoot` / `unwrapRoot` (Argon2id in place of the PRF:
   `argon2id(password, salt, params) -> AES key -> seal/open(root)`). Pure crypto,
   unit-tested (round-trip, fail-closed on wrong password/params, fresh salt per wrap, NFC
   normalization, pinned launch cost). Argon2id is a bundled WASM (hash-wasm), imported
   only by the recovery/settings chunk so it stays out of the precached shell. The params
   are stored with the envelope and versioned; confirm the cost on a target phone before
   launch.
2. **Strength gate.** _Built._ A pure `gradePassword(pw) -> { ok } | { ok: false, reason }`
   in `auth/passwordStrength.ts`: minimum length, a local common-password wordlist
   (`auth/commonPasswords.ts`), and a zxcvbn estimate that must reach its strongest bucket
   (score 4). The estimator is `@zxcvbn-ts/core` (the pattern engine) seeded with the
   compact bundled wordlist instead of the multi-megabyte language pack, so it stays in the
   lazy recovery/settings chunk. Client-only (no candidate ever leaves the device); reject
   copy follows the voice guide (plain, no lecturing, no attack description). Unit-tested
   against weak/strong cases and the pinned constants.
3. **Server: envelope storage.** _Built._ A `recovery_envelope` table (locator -> one
   fixed-size opaque blob + `hash(account write token)`), the fixed-size decoy-uniform
   read, and the write/delete (write-token authorized, and existence-uniform per the note
   above), all behind an `STI_RECOVERY_ENABLED` launch gate so the surface is a bare 404
   until recovery ships. The locator shares the vanity-name charset but is shape-validated
   only (a private lookup key, not a public directory entry). Go tests cover the round
   trip, the fixed-size decoy on a miss, wrong-size/malformed/missing-token rejects, the
   uniform-and-safe collision, delete, and the gated-off 404; the ciphertext-projection
   guard allowlists the new getter.
4. **Settings: manage factors (doc 31).** _Store layer built; UI pending._ The client
   plumbing is in: the `/recovery` API client, `store/recoveryOps.ts`
   (`setRecoveryPassword` / `disableRecoveryPassword`) wired through the SessionController,
   and a `recoveryName` field on the account blob (schema v13) so the chosen locator is
   remembered for re-view and turn-off. Because the session root is non-extractable (doc
   24), turning the password on takes the recovery **phrase**, re-derives the root, and
   verifies the phrase names this account before wrapping; a locator collision is caught
   client-side (read back and confirm our own password opens it). The password-envelope
   crypto and the strength gate load via dynamic import so their WASM/estimator stay out
   of the precached shell. Still to build: the Settings card UI (pick a recovery name, set
   + confirm past the gate, change, turn off, re-view the phrase) and its stories.
5. **New-device unlock by recovery name + password.** The login path that fetches the
   envelope by locator and opens it with the password, recovering the root key and loading
   the account, alongside the existing phrase and passkey paths.
6. **Continuity nudges (later, optional).** The gentle rehearsal and the once-a-year
   reminder from the sections above: reminders, never forced resets, never blocking use.

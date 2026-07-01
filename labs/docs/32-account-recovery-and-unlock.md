# 32 - Account recovery and unlock

## Status: LAUNCHED (the plan at the end tracks what is built; the public-handle login name and password-at-sign-up are the remaining build, and continuity nudges stay optional/later)

How a person keeps access to their account across devices and over time, and how an
optional, memorable password can fit without weakening the blind store. This doc owns
the recovery/unlock factor model. It builds on [24-stay-signed-in](24-stay-signed-in.md)
(the on-device resumable session), uses the public handle from
[17-vanity-namespace-governance](17-vanity-namespace-governance.md) as the password's
login name, and does not change the server boundary in
[10-build-backend-and-deployment](10-build-backend-and-deployment.md): the server
still holds only ciphertext.

The passkey is the recommended way back in: nothing to type, and it cannot be phished.
A password is a supported, weaker alternative, offered for people who want a familiar
"name and password" they can use on any device. When a password is set, its login name
is a **public handle** (the same findable name governed by doc 17), so the pattern is
the ordinary "@name plus password," not a second secret to remember.

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

The account's real anchor is the **root key**. Passkey, recovery phrase, and password are
all just wrappers around it, none of them more "the account" than the others. That framing
matters below: because they are peers, a password can be chosen at sign-up as easily as a
passkey, and either can be added or dropped later without touching the account id or any
link.

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
- **Password (opt-in, not the default)** - a memory-hard KDF of the password (Argon2id,
  per-account random salt, a deliberately high cost) wraps the root key. Its wrapped-key
  envelope is stored server-side as ciphertext, so it works on any device: name the
  envelope by a **public handle** (doc 17), fetch it, unwrap with the password, recover
  the root key. This is the memorable, cross-device path some people want, and it is the
  same wrap pattern the passkey already uses, just stored server-side and keyed by a
  password instead of a passkey. It is deliberately not the recommended path: a password
  is weaker than a passkey (a person can be tricked into typing it, and it can be guessed),
  so it is kept behind a strict strength gate and paired with a public handle as its login
  name. See [The login name is a public handle](#the-login-name-is-a-public-handle).

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

A password can be set two ways: chosen **at sign-up** (root still in memory, no phrase
re-entry) or turned on later in **Settings** (see [31-app-shape](31-app-shape.md)), which
takes the phrase to re-derive the root before wrapping. In Settings the owner can also
re-view the phrase, turn an optional password off (which drops its envelope and unpins the
handle), and see which unlock methods are active. Changing the password re-wraps a fresh
envelope; it never re-keys the root key, so links and the account id are untouched.

## Honesty (user-facing copy)

Per [21-voice-and-tone](21-voice-and-tone.md), state what is protected, never how it
could be attacked, and never overclaim. A password's copy must not imply it is as
strong as the phrase or a passkey; it should read as a convenient, weaker way back in,
with the passkey recommended and the phrase named as the real backstop. The strength
gate's message says plainly that a weak password is not accepted, without lecturing.
Because a password's login name is a public handle, the copy also keeps the honest note
that setting one means claiming a public name people can find you by (doc 17's disclosure
applies).

## The login name is a public handle

The envelope model glosses one hard problem: on a **new device with only the password**,
how does the client find which envelope to fetch? The account id derives from the
phrase, which the person does not have on the new device, and it must **never** derive
from the password (that is the oracle this whole doc avoids). A password alone therefore
cannot name its own envelope. It needs a **non-secret login name** that names the
envelope, distinct from the password.

That login name is a **public handle**, the same findable name governed by
[17-vanity-namespace-governance](17-vanity-namespace-governance.md). There is no separate
"recovery name" concept. To turn a password on, you either **claim a new public handle**
or **reuse a public handle you already hold**; the familiar pattern is "@name plus
password." The normalized handle is the locator that names the envelope.

- The handle **names** the envelope; the password **opens** it. Cross-device sign-in is
  "@name plus password," two things a person already understands, not one obscure secret.
  The phrase stays the real backstop.
- The handle is **not a secret and not the account id.** It maps, server-side, to
  `handle -> { envelope ciphertext, kdf params, salt }`. Knowing a handle lets someone
  *fetch an envelope ciphertext* (rate-limited, below), never *open* it: the password
  plus the Argon2id cost is the only thing protecting the wrapped root. This is the same
  weakest-link cost already named ("an attacker who steals that one envelope can attack
  it offline"); the handle only decides *which* envelope, it does not weaken it.
- The handle must not be a password-derived value (that would re-introduce a
  password-to-server-visible-value oracle). It is owner-chosen, like a username, and lives
  in the doc 17 directory, validated by doc 17's charset and length rules.
- **Setting a password proves ownership of the handle.** Writing the envelope is
  authorized by the handle's alias write token (doc 17), so the directory entry and the
  recovery envelope always belong to the same owner. You cannot key a password to a name
  someone else holds.
- **Setting a password pins the handle.** While a password is set, its handle cannot be
  released or deleted (that would orphan the login, or hand the login name to a stranger).
  Removing the password unpins it. This is the doc 17 rule
  ([Pinned handles](17-vanity-namespace-governance.md#pinned-handles-a-handle-that-carries-a-password-login)),
  referenced here.

The directory reveals that a **name exists** (that is the whole point of a findable name,
doc 17). It does **not** reveal that the name has a password login. Whether a handle has a
recovery envelope stays hidden: the envelope read is existence-uniform (a fixed-size decoy
on a miss), and writes and deletes are silent no-ops on a token mismatch, exactly as the
resolved decisions below specify. So "this name exists" is public; "this name can be
logged into with a password" is not.

**Requiring a public handle adds no new exposure.** A handle's existence is discoverable
only through the directory resolve (the as-you-type availability check and `GET /u/{name}`),
which is the inherent, opt-in cost of choosing a findable name at all, the same whether or
not a password rides on it. A raw link visit still reveals nothing on its own: an opaque
private link, and a valid private link opened without its key, both present the same "ask
to connect" surface without confirming that an account exists (the knock flow in
[13-contact-graph-and-notification](13-contact-graph-and-notification.md)). The only place
existence surfaces is the directory, never a link fetch. So the privacy-conscious path is
untouched: share only private links, never claim a public handle, and password sign-in
simply never applies, with existence never revealed. The public handle is opt-in
convenience for people who have already chosen to be findable.

This keeps the invariant intact: nothing the server can see is derived from the password,
and the always-present account id stays a function of the high-entropy phrase only.

## Password as a sign-up choice, not only a Settings add-on

Because the account's anchor is the root key and every factor is just a wrapper around it,
a password can be chosen **at sign-up**, right beside a passkey, not only added later in
Settings.

The reason this is clean at sign-up is timing. At sign-up the freshly generated root is
**in memory**, so it can be wrapped with @handle plus password on the spot, with **no
recovery-phrase re-entry**. (That re-entry friction only exists when adding a password
*later*, on a device that has dropped the raw root: the session root is non-extractable
by then, per [24-stay-signed-in](24-stay-signed-in.md), so turning a password on later
takes the phrase to re-derive the root before wrapping.)

So sign-up offers a **choice of how to get back in**: a passkey, and/or a public handle
plus password. A person can pick either, or both. Whatever they pick, sign-up **always
still generates and shows the recovery phrase** as the ultimate backup, so no path leaves
the account without its high-entropy backstop. Claiming a handle at sign-up pins it the
same way it would from Settings.

## Resolved decisions

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
  wrapped-key envelopes as opaque records keyed by the **public handle**: `{ handle,
  factor, version, kdfParams, salt, wrappedRoot }`. Everything is opaque ciphertext except
  `kdfParams` + `salt` (needed to derive the unwrap key; a salt is not a secret).
  Fetching an envelope is **rate-limited per IP** (and by a global bucket) like a
  sensitive read and returns a uniform, fixed-size envelope-shaped response (real or a
  deterministic decoy on a miss), so the store is not a freely harvestable target and
  not an existence oracle. So even though the directory reveals the handle exists, the
  envelope store never reveals the handle has a password login. Writing/replacing an
  envelope (enable, change, disable) is authorized by the **handle's alias write token**
  (doc 17), which ties the envelope to the same owner as the directory entry.

  **The write and delete paths are existence-uniform too.** A write against a handle whose
  envelope is already held under a different token is a silent no-op (never an overwrite,
  never a distinguishing error), and a delete with a non-matching token or a missing
  envelope is likewise a uniform success. So neither the write nor the delete path
  confirms whether a handle has an envelope, the complement of the decoy-uniform read. The
  cost is that a genuine collision is not reported at set-time by the server; instead the
  owner detects it **client-side** by fetching the just-written envelope and confirming
  their own password opens it (only they can). The phrase remains the backstop, so a
  mis-set login is never account-ending.

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
   above). The locator shares the vanity-name charset and is shape-validated. Go tests
   cover the round trip, the fixed-size decoy on a miss, wrong-size/malformed/missing-token
   rejects, the uniform-and-safe collision, and delete; the ciphertext-projection guard
   allowlists the new getter. _Change to build: the locator is unified with the doc 17
   public handle rather than a standalone name, and the write is authorized by the handle's
   alias write token so the envelope and the directory entry share an owner._
4. **Settings: manage factors (doc 31).** _Built._ The `/recovery` API client,
   `store/recoveryOps.ts` (`setRecoveryPassword` / `disableRecoveryPassword`) wired
   through the SessionController. Because the session root is non-extractable (doc 24),
   turning the password on later takes the recovery **phrase**, re-derives the root, and
   verifies the phrase names this account before wrapping; a collision is caught
   client-side (read back and confirm our own password opens it). The Settings card
   (`ui/settings/RecoveryPassword.tsx`) has an off state (your public handle + password
   with live strength feedback + confirm + phrase) and an on state (handle, change, turn
   off), rendered from the Privacy screen for a logged-in owner. The envelope crypto and
   the strength gate load via dynamic import, so their WASM/estimator stay out of the
   precached shell. _Change to build: the login name is a public handle (claim a new one
   or reuse one you hold) rather than a standalone recovery name; setting a password pins
   the handle and turning it off unpins it (doc 17); turning it off drops the envelope._
   Re-viewing the phrase itself from Settings is also built: the phrase is stored inside
   the already-encrypted account blob (`store/accountBlob.ts`, written at sign-up and
   backfilled on a phrase login) so a root-holding session can re-display it behind a
   deliberate gate (`ui/settings/RecoveryPhrase.tsx`: a collapsed row, a surroundings
   warning, and an explicit "show it"). An account that has only resumed by passkey has
   no stored phrase, so the card shows an honest "sign in with it once to see it here"
   fallback instead of erroring. Storing the phrase adds no derivation power (opening the
   blob already needs the root the phrase derives) and it never leaves the encrypted vault.
5. **New-device unlock by @handle + password.** _Built._ The sign-in screen offers this
   beside the passkey and the recovery phrase: enter @handle + password, which fetches the
   envelope by handle and opens it, recovering the root key and loading the account. A
   wrong name or password is one uniform failure. _Change to build: the field is a public
   handle, and the sign-in shape leads with passkey and folds @handle + password and the
   recovery phrase under an "other ways to log in" disclosure (doc 31)._
6. **Password at sign-up (new capability to build).** Offer @handle + password as a
   sign-up choice beside the passkey, wrapping the in-memory root on the spot with **no
   phrase re-entry**, and always still generating and showing the recovery phrase. Claiming
   the handle at sign-up pins it (doc 17). This is the one genuinely new build here; the
   Settings add-later path above is unchanged apart from the public-handle rename.
7. **Continuity nudges (later, optional).** The gentle rehearsal and the once-a-year
   reminder from the sections above: reminders, never forced resets, never blocking use.

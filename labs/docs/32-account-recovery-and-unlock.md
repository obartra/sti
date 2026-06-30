# 32 - Account recovery and unlock

## Status: PROPOSED (design)

How a person keeps access to their account across devices and over time, and how an
optional, memorable password can fit without weakening the blind store. This doc owns
the recovery/unlock factor model. It builds on [24-stay-signed-in](24-stay-signed-in.md)
(the on-device resumable session) and does not change the server boundary in
[10-build-backend-and-deployment](10-build-backend-and-deployment.md): the server
still holds only ciphertext.

## The problem

Today the **recovery phrase is the single root secret**: phrase derives the master,
and the master derives the account id, the blob-encryption key, and the write token.
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

## The model: wrap a key, do not be the key

Stop deriving the key from a secret, and instead wrap a key with each secret:

- Generate a **random master key** for the account. The account id, blob key, and
  write token derive from this random master, exactly as today, so the server-visible
  id is independent of any human-chosen secret.
- Each enabled **factor encrypts its own copy of the master** (an "envelope"). To
  unlock, a device opens any one envelope and recovers the master.

Factors:

- **Recovery phrase** - wraps the master. High-entropy, the unbreakable backstop.
  Always present.
- **Passkey / biometric** - wraps the master per device (biometrics are not a separate
  factor; they gate the passkey). Synced passkeys (platform keychains) already give
  cross-device continuity within one ecosystem for free.
- **Password (opt-in)** - a memory-hard KDF of the password (Argon2id, per-account
  random salt, a deliberately high cost) wraps the master. Its wrapped-master envelope
  is stored server-side as ciphertext, so it works on any device: fetch the envelope,
  unwrap with the password, recover the master. This is the memorable, cross-device
  path the product wants.

The account id derives from the random master, **never from the password**, so adding a
password introduces no server-side oracle: a stolen account id still cannot be attacked,
because it is not a function of the password.

## The tradeoff to accept on purpose

Multi-factor *unlock* is an OR: opening any envelope yields the master, so the account
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

- The server holds only ciphertext (the blob, plus now per-factor wrapped-master
  envelopes, which are themselves ciphertext) and minimal routing data. It learns no
  secret and gains no oracle.
- The phrase remains the high-entropy backstop and is always present, so a forgotten
  password never strands the account.
- On-device resume ([24-stay-signed-in](24-stay-signed-in.md)) is unchanged: the
  resumable master still lives as a non-extractable key in IndexedDB.

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
  **recovery rehearsal, not a lockout**. It nudges, it does not strand. Biometrics still
  handle everyday unlock between rehearsals, so this is rare, not a tax on each open.
- **Forced calendar rotation (no).** A yearly "you must change your password" is an
  anti-pattern: scheduled rotation pushes people to weaker, predictable variants and
  buys little. Current guidance (NIST) is explicit against it. Instead, rotate **on a
  signal of compromise**, and offer an **optional** "review your security" nudge rather
  than a mandatory reset. If a password is rotated, it just re-wraps a fresh envelope;
  the master and the account id never change.

## Where this is managed

Factors are added, viewed, and removed in **Settings** (see
[31-app-shape](31-app-shape.md)): re-view the phrase, turn an optional password on or
off (which mints or drops its envelope), and see which unlock methods are active.
Changing the password re-wraps a fresh envelope; it never re-keys the master, so links
and the account id are untouched.

## Honesty (user-facing copy)

Per [21-voice-and-tone](21-voice-and-tone.md), state what is protected, never how it
could be attacked, and never overclaim. A password's copy must not imply it is as
strong as the phrase; it should read as a convenient way back in, with the phrase named
as the real backstop. The strength gate's message says plainly that a weak password is
not accepted, without lecturing.

## Open questions (resolve before building)

- **Password-only accounts:** should a person be allowed to skip the phrase entirely
  and rely on a password envelope? Leaning no: the phrase is the backstop that keeps a
  forgotten password from being terminal, so it should always exist even if de-emphasized.
- **KDF parameters:** the exact Argon2id memory/time/parallelism and the strength-gate
  threshold are security constants to set deliberately, sized to current hardware.
- **Envelope storage and rate-limiting:** the server stores per-factor wrapped-master
  envelopes; fetching one should be gated like any account read, so the envelope is not
  a freely harvestable target.
- **Local PIN unlock - probably not needed.** A device-only PIN that unwraps the stored
  master is a separate convenience from the cross-device password, and biometrics /
  passkey already cover everyday device unlock, so a PIN mostly adds surface for little
  gain. The case for it is a device with no biometrics; absent that gap, lean toward
  dropping it rather than building it. It does not affect the envelope model either way.

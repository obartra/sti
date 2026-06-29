# 24 - Stay signed in (session resume across reload)

Status: BUILT (non-extractable `MasterKey`, `masterKeyStore`, resumable session, and the keep-signed-in toggle all shipped).

## Why

Reloading the page logs the owner out. The unlocked master lives only in React
state (`session` starts `null` on every mount), and getting back in needs a
passkey ceremony, which browsers gate behind a user gesture, so there is no
silent restore. Every refresh drops the owner to logged-out.

## The decision

Keep the owner signed in across reloads (and browser restarts) by persisting the
master as a **non-extractable WebCrypto `CryptoKey`** in IndexedDB.

- Non-extractable: the key can be USED on the device (it derives the account id,
  blob key, and write token) but can never be exported as raw bytes, so even a
  script injected into the page cannot copy the master out to reuse elsewhere.
  That closes the worst case (master theft) without pretending an in-page
  compromise is harmless.
- It is opt-in per device: a **"Keep me signed in on this device"** choice gates
  the persistence (default ON; OFF means a reload re-asks, the safe behavior for
  a shared computer). The honesty lives at the toggle, not on the promises page.
- Logout and account-delete wipe the stored key.

Nothing about the server or the blind-store boundary changes. The recovery
phrase remains the cross-device path; the passkey remains the no-phrase re-login.

## The master key lifecycle

Today `master` is raw `Bytes` threaded through the account/session layers. It
becomes a non-extractable `CryptoKey` (`MasterKey`), used directly by HKDF. The
derivations are byte-identical (same key material, same HKDF params), so existing
accounts keep resolving, this is not a blob/contract change.

Raw master bytes still exist transiently, only at the moments a secret enters:
account create (phrase -> PBKDF2), recover (phrase), and passkey unlock (PRF ->
unwrap). At each, the bytes are imported once into the non-extractable `MasterKey`
and dropped. After that, no layer holds raw bytes.

The one consequence: the passkey enroll used to wrap `session.master` (raw bytes).
A non-extractable key cannot be wrapped, so enroll re-derives the bytes from the
recovery phrase (already held during onboarding to show at step 2) at the moment
of enroll, wraps them, and drops them. The passkey wrap is unchanged on the wire.

## Pieces

1. `crypto/keys.ts`: `MasterKey = CryptoKey`; `importMasterKey(bytes)` (HKDF,
   extractable `false`); `deriveAccountId/Key/WriteToken` take a `MasterKey`.
   `deriveMasterKey(phrase)` still returns the transient bytes.
2. `master: Bytes -> MasterKey` through `account.ts`, `accountSync.ts`,
   `session.ts`, `OwnerSession`.
3. `enrollPasskey` re-derives bytes from the recovery phrase rather than reading
   `session.master`.
4. New `masterKeyStore` (IndexedDB): `save(MasterKey)`, `load()`, `clear()`.
   Cleared on logout and on account-delete.
5. App boot: if a stored key exists, `sync.load` the blob and set the session,
   the silent resume. No passkey, no bytes.
6. UI: a "Keep me signed in on this device" toggle (default ON) at sign-up and
   login, with an honest caveat; a Log out control that clears the stored key.

## Honest limits / consequences

- Stays signed in across browser restarts until logout (IndexedDB persists). The
  toggle is the shared-device control; OFF does not persist.
- An in-page (XSS) compromise can still act as the owner while the page is open;
  it just cannot exfiltrate the master. Non-extractable bounds the blast radius,
  it does not make a compromised page safe.
- Clearing browser data or a private window logs the owner out (recovery phrase
  recovers).
- An idle/expiry auto-logout is a possible fast follow, not in this slice.

## Testing

- Derivation compatibility: id/blob-key/write-token from a `MasterKey` equal the
  values the old byte path produced (so existing accounts unlock).
- `masterKeyStore` round-trips a non-extractable key and `clear()` removes it;
  the loaded key is `extractable === false` and cannot be exported.
- Resume-from-store builds a session without a passkey.
- The passkey ceremony itself stays untestable headless, as today (noted).

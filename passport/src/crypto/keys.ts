/**
 * Key and id derivation for the blind boundary.
 *
 * Three distinct mechanisms, deliberately not one (see doc 11):
 *
 * - **Alias id + write token are random.** An owner mints a random read id and a
 *   random write token when creating an alias and stores both in the device blob.
 *   The server only validates an id's shape and stores `hash(write-token)` on the
 *   first PUT, so there is nothing to derive: the id is a capability the owner
 *   hands out via a link, the write token is the capability they keep.
 * - **The account id is key-derived** from the owner's root key, so any device
 *   that recovers the key can find the sync blob with no server-side registry.
 * - Routing tokens (notify, knock) are hashes of pairwise secrets; their exact
 *   wire form is pinned against the server in the knock/notify slice, not here.
 *
 * The root key itself comes from a passkey (WebAuthn PRF) or a recovery
 * passphrase. This module implements the passphrase path (PBKDF2); the passkey
 * path is wired in the onboarding slice and produces the same 32-byte key.
 */

import { bytesToBase64url, type Bytes } from "./encoding.ts";

const ID_BYTES = 32; // 256-bit, encodes to the contract's fixed 43-char id
const PBKDF2_ITERATIONS = 600_000; // OWASP 2023 floor for PBKDF2-HMAC-SHA256
const HKDF_ACCOUNT_ID_INFO = "sti.care/account-id/v1";
const HKDF_ACCOUNT_KEY_INFO = "sti.care/account-blob-key/v1";
const HKDF_ACCOUNT_WRITE_INFO = "sti.care/account-write/v1";
const HKDF_PRF_ROOT_INFO = "sti.care/master-key/prf/v1";

// A fixed domain-separation salt, deliberately NOT a per-user anti-rainbow salt.
// The account id is itself derived from the root key, so a per-user salt could
// never be fetched before deriving that id (it would be circular). The
// blind-store guarantee for the passphrase path therefore rests on the recovery
// passphrase being APP-GENERATED with high entropy (>= 128 bits, shown once at
// signup), so it is globally unique and unguessable, which is what makes a
// per-user salt unnecessary. User-CHOSEN passphrases are out of scope here: they
// would need a memory-hard KDF (Argon2id) and a different account-addressing
// scheme.
const ROOT_KEY_SALT = "sti.care/master-key/v1";

function randomOpaqueId(): string {
  return bytesToBase64url(crypto.getRandomValues(new Uint8Array(ID_BYTES)));
}

/** A random alias read id (the capability shared via a link). */
export function randomAliasId(): string {
  return randomOpaqueId();
}

/** A random write token (the capability the owner keeps to publish/overwrite). */
export function randomWriteToken(): string {
  return randomOpaqueId();
}

/**
 * A recovery phrase the app generated (256-bit, app-format). Branded so the only
 * way to obtain one is {@link randomRecoveryPhrase} (signup) or
 * {@link parseRecoveryPhrase} (recovery, which validates the format). This is the
 * enforcement of the {@link ROOT_KEY_SALT} entropy contract: a future
 * user-CHOSEN passphrase cannot reach {@link deriveRootKey} without going
 * through the format check (which it would fail) or an explicit, review-visible
 * cast. The fixed-salt KDF is safe ONLY for these, so the type makes that a
 * compile-time invariant rather than a comment.
 */
export type AppGeneratedPhrase = string & {
  readonly __appGeneratedPhrase: unique symbol;
};

// The app phrase is `bytesToBase64url(32 bytes)`: 43 base64url chars, no padding.
const RECOVERY_PHRASE_RE = /^[A-Za-z0-9_-]{43}$/;

/**
 * A high-entropy recovery phrase (256-bit): the single secret that unlocks an
 * account. It MUST be app-generated, not user-chosen (see {@link ROOT_KEY_SALT}).
 * A human-friendly word encoding is a UX follow-up; the crypto only needs the
 * entropy.
 */
export function randomRecoveryPhrase(): AppGeneratedPhrase {
  return randomOpaqueId() as AppGeneratedPhrase;
}

/**
 * Validate user-entered recovery input against the app phrase format and brand it,
 * or null if it is not a well-formed app phrase. Recovery routes user input through
 * here so a malformed phrase fails closed (no account) instead of deriving a key
 * from arbitrary low-entropy text.
 */
export function parseRecoveryPhrase(input: string): AppGeneratedPhrase | null {
  return RECOVERY_PHRASE_RE.test(input.trim())
    ? (input.trim() as AppGeneratedPhrase)
    : null;
}

/**
 * Derive a 32-byte root key from an app-generated recovery phrase. The phrase
 * MUST be app-generated and high-entropy (see {@link ROOT_KEY_SALT}); there is no
 * per-user salt by design, so the {@link AppGeneratedPhrase} brand gates the input.
 */
export async function deriveRootKey(
  passphrase: AppGeneratedPhrase,
): Promise<Bytes> {
  const base = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: new TextEncoder().encode(ROOT_KEY_SALT),
      iterations: PBKDF2_ITERATIONS,
    },
    base,
    ID_BYTES * 8,
  );
  return new Uint8Array(bits);
}

/**
 * The owner's root key as a non-extractable WebCrypto key (doc 24). It derives
 * the account id, blob key, and write token but can never be exported as raw
 * bytes, so it is safe to persist for resume (a script that reaches the page can
 * use it while open but cannot copy it out). Import it once from the transient
 * bytes a sign-in produces (account create, recover, or passkey unlock), then
 * drop the bytes.
 */
export type RootKey = CryptoKey;

/**
 * Import raw root key bytes into a non-extractable HKDF {@link RootKey}. The
 * caller drops the bytes afterwards; the key derives byte-identically to the old
 * raw path, so existing accounts keep resolving.
 */
export function importRootKey(root: Bytes): Promise<RootKey> {
  return crypto.subtle.importKey("raw", root, "HKDF", false, ["deriveBits"]);
}

// HKDF from an already-imported key (the root): salt empty, info domain-separates.
async function hkdfFromKey(
  key: CryptoKey,
  info: string,
  bytes: number,
): Promise<Bytes> {
  const out = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(0),
      info: new TextEncoder().encode(info),
    },
    key,
    bytes * 8,
  );
  return new Uint8Array(out);
}

// HKDF from raw bytes: imports them as an HKDF key first. Used where the input is
// a transient secret that is NOT the persisted root (the passkey PRF output).
async function hkdfFromBytes(
  raw: Bytes,
  info: string,
  bytes: number,
): Promise<Bytes> {
  return hkdfFromKey(await importRootKey(raw), info, bytes);
}

/** Deterministic opaque account id (43-char base64url) for `GET/PUT /acct/{id}`. */
export async function deriveAccountId(root: RootKey): Promise<string> {
  return bytesToBase64url(
    await hkdfFromKey(root, HKDF_ACCOUNT_ID_INFO, ID_BYTES),
  );
}

/** Raw 32-byte AES key for the account-sync blob, separate from the id. */
export function deriveAccountKey(root: RootKey): Promise<Bytes> {
  return hkdfFromKey(root, HKDF_ACCOUNT_KEY_INFO, 32);
}

/**
 * The account write token (43-char base64url): the capability that gates overwrite
 * and delete of the account blob, making account writes symmetric with aliases. A
 * third independent derivation from the root, so it never equals the id (which
 * travels on the wire) or the blob key (which never leaves the device). The server
 * stores only its hash and constant-time compares, so observing the id alone does
 * not let someone clobber the account.
 */
export async function deriveAccountWriteToken(root: RootKey): Promise<string> {
  return bytesToBase64url(
    await hkdfFromKey(root, HKDF_ACCOUNT_WRITE_INFO, ID_BYTES),
  );
}

/**
 * A 32-byte wrapping key from a passkey's PRF output. The PRF result is a
 * high-entropy authenticator secret; HKDF domain-separates it. This wraps
 * (encrypts) the account root for convenient local re-unlock, so the passkey
 * is a SECOND credential over the same phrase-recoverable account, never a
 * standalone root that would lock out on passkey loss (see auth/keyVault).
 */
export function wrapKeyFromPrf(prfOutput: Bytes): Promise<Bytes> {
  return hkdfFromBytes(prfOutput, HKDF_PRF_ROOT_INFO, ID_BYTES);
}

/** SHA-256 of `data`, base64url-encoded. Used for opaque routing/requester
 * hashes the server treats as plain string keys. */
export async function sha256Base64url(data: Bytes): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bytesToBase64url(new Uint8Array(digest));
}

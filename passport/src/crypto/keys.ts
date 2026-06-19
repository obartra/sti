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
 * - **The account id is key-derived** from the owner's master key, so any device
 *   that recovers the key can find the sync blob with no server-side registry.
 * - Routing tokens (notify, knock) are hashes of pairwise secrets; their exact
 *   wire form is pinned against the server in the knock/notify slice, not here.
 *
 * The master key itself comes from a passkey (WebAuthn PRF) or a recovery
 * passphrase. This module implements the passphrase path (PBKDF2); the passkey
 * path is wired in the onboarding slice and produces the same 32-byte key.
 */

import { bytesToBase64url, type Bytes } from "./encoding.ts";

const ID_BYTES = 32; // 256-bit, encodes to the contract's fixed 43-char id
const PBKDF2_ITERATIONS = 600_000; // OWASP 2023 floor for PBKDF2-HMAC-SHA256
const HKDF_ACCOUNT_ID_INFO = "sti.care/account-id/v1";
const HKDF_ACCOUNT_KEY_INFO = "sti.care/account-blob-key/v1";

// A fixed domain-separation salt, deliberately NOT a per-user anti-rainbow salt.
// The account id is itself derived from the master key, so a per-user salt could
// never be fetched before deriving that id (it would be circular). The
// blind-store guarantee for the passphrase path therefore rests on the recovery
// passphrase being APP-GENERATED with high entropy (>= 128 bits, shown once at
// signup), so it is globally unique and unguessable, which is what makes a
// per-user salt unnecessary. User-CHOSEN passphrases are out of scope here: they
// would need a memory-hard KDF (Argon2id) and a different account-addressing
// scheme.
const MASTER_KEY_SALT = "sti.care/master-key/v1";

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
 * A high-entropy recovery phrase (256-bit): the single secret that unlocks an
 * account. It MUST be app-generated, not user-chosen (see {@link MASTER_KEY_SALT}).
 * A human-friendly word encoding is a UX follow-up; the crypto only needs the
 * entropy, and {@link deriveMasterKey} accepts any string.
 */
export function randomRecoveryPhrase(): string {
  return randomOpaqueId();
}

/**
 * Derive a 32-byte master key from a recovery passphrase. The passphrase must be
 * app-generated and high-entropy (see {@link MASTER_KEY_SALT}); there is no
 * per-user salt by design.
 */
export async function deriveMasterKey(passphrase: string): Promise<Bytes> {
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
      salt: new TextEncoder().encode(MASTER_KEY_SALT),
      iterations: PBKDF2_ITERATIONS,
    },
    base,
    ID_BYTES * 8,
  );
  return new Uint8Array(bits);
}

async function hkdf(
  master: Bytes,
  info: string,
  bytes: number,
): Promise<Bytes> {
  const key = await crypto.subtle.importKey("raw", master, "HKDF", false, [
    "deriveBits",
  ]);
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

/** Deterministic opaque account id (43-char base64url) for `GET/PUT /acct/{id}`. */
export async function deriveAccountId(master: Bytes): Promise<string> {
  return bytesToBase64url(await hkdf(master, HKDF_ACCOUNT_ID_INFO, ID_BYTES));
}

/** Raw 32-byte AES key for the account-sync blob, separate from the id. */
export function deriveAccountKey(master: Bytes): Promise<Bytes> {
  return hkdf(master, HKDF_ACCOUNT_KEY_INFO, 32);
}

/** SHA-256 of `data`, base64url-encoded. Used for opaque routing/requester
 * hashes the server treats as plain string keys. */
export async function sha256Base64url(data: Bytes): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bytesToBase64url(new Uint8Array(digest));
}

/**
 * The optional password factor (doc 32): a second envelope around the same
 * phrase-derived account root, opened by a memorable password instead of a
 * passkey. It mirrors {@link ./keyVault.ts}'s wrapRoot/unwrapRoot exactly, with a
 * memory-hard Argon2id KDF standing in for the passkey's PRF output: the password
 * is stretched into a 32-byte AES key that seals (encrypts) the root, and the
 * sealed copy plus its KDF parameters and salt form the envelope.
 *
 * Why Argon2id and not the phrase path's PBKDF2 + fixed salt: a password is
 * human-chosen and low-entropy, so its envelope is the account's weakest link once
 * stolen (doc 32, "the tradeoff to accept on purpose"). A memory-hard KDF with a
 * per-account random salt makes an offline attack on a stolen envelope as costly as
 * we can, and the salt being per-account stops one precomputation covering many.
 *
 * The crucial invariant doc 32 holds: NOTHING the server sees is derived from the
 * password. This module only ever turns a password into an AES key that decrypts a
 * locally-held or server-fetched envelope; the account id keeps deriving from the
 * high-entropy phrase (crypto/keys.ts), never from here. A wrong password yields a
 * different Argon2id output, so the AES-GCM open rejects and recovery fails closed,
 * exactly like a wrong passkey.
 *
 * The Argon2id implementation is a bundled WASM (hash-wasm). It is imported only by
 * the recovery/settings surfaces, which load as their own chunk, so the WASM never
 * lands in the precached offline shell (doc 22 budget).
 */

import { argon2id } from "hash-wasm";
import {
  importAesKey,
  seal,
  open,
  utf8ToBytes,
  type Bytes,
} from "../crypto/index.ts";
import { RECOVERY_ENVELOPE_SIZE } from "../api/contract.ts";

/**
 * The Argon2id cost, versioned and stored with each envelope so an old envelope
 * still opens with its original cost and a re-wrap can raise the cost later without
 * stranding anyone (doc 32). These are security constants: raise them deliberately,
 * never silently.
 */
export interface Argon2Params {
  /** Bumped when the parameter set's meaning changes, not on every tuning. */
  readonly version: 1;
  /** Memory cost in KiB. 65536 = 64 MiB. */
  readonly memoryKiB: number;
  /** Time cost (number of passes). */
  readonly iterations: number;
  /** Lanes; 1 keeps the cost predictable across devices. */
  readonly parallelism: number;
}

/**
 * The launch starting point from doc 32: memory 64 MiB, time 3, parallelism 1 (a
 * deliberately high, ~sub-second-on-a-phone cost). To be confirmed by measuring on
 * a low-end target phone before launch; bumping any of these mints a heavier
 * envelope on the next re-wrap while older envelopes keep opening at their stored
 * cost.
 */
export const ARGON2_DEFAULT_PARAMS: Argon2Params = {
  version: 1,
  memoryKiB: 64 * 1024,
  iterations: 3,
  parallelism: 1,
};

const SALT_BYTES = 16; // per-account random anti-precomputation salt (not a secret)
const WRAP_KEY_BYTES = 32; // AES-256

/**
 * A password envelope: the sealed root plus everything needed to re-derive its
 * unwrap key. `salt` and `params` are not secret (a salt never is; the params are
 * just cost), so they travel in the clear; `wrappedRoot` is the only ciphertext.
 * This is the on-the-wire/at-rest shape the storage slice keys by the recovery
 * locator (doc 32).
 */
export interface PasswordEnvelope {
  readonly params: Argon2Params;
  readonly salt: Bytes;
  readonly wrappedRoot: Bytes;
}

/**
 * Stretch a password into a 32-byte AES wrapping key with Argon2id. The password is
 * NFC-normalized first so the same characters typed on different devices/keyboards
 * derive the same key (a real cross-device unlock concern, not cosmetic).
 */
async function wrapKeyFromPassword(
  password: string,
  salt: Bytes,
  params: Argon2Params,
): Promise<Bytes> {
  // hash-wasm types its binary output as Uint8Array over an arbitrary buffer; copy
  // into a fresh ArrayBuffer-backed array to satisfy the Bytes contract.
  return new Uint8Array(
    await argon2id({
      password: utf8ToBytes(password.normalize("NFC")),
      salt,
      parallelism: params.parallelism,
      iterations: params.iterations,
      memorySize: params.memoryKiB,
      hashLength: WRAP_KEY_BYTES,
      outputType: "binary",
    }),
  );
}

/**
 * Encrypt the account root under a password, minting a fresh envelope. The caller
 * passes the raw root bytes (the same bytes deriveRootKey produces, before they are
 * imported as the non-extractable RootKey), exactly as keyVault.ts's wrapRoot does.
 * A new random salt each call means changing the password re-wraps a distinct
 * envelope without re-keying the root or the account id (doc 32).
 */
export async function wrapPasswordEnvelope(
  root: Bytes,
  password: string,
  params: Argon2Params = ARGON2_DEFAULT_PARAMS,
): Promise<PasswordEnvelope> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const key = await importAesKey(
    await wrapKeyFromPassword(password, salt, params),
  );
  const wrappedRoot = await seal(key, root);
  return { params, salt, wrappedRoot };
}

/**
 * Recover the account root from an envelope and its password. A wrong password
 * derives a different Argon2id key, so the AES-GCM open rejects (throws) and the
 * caller fails closed, the same way a wrong passkey does in keyVault.ts.
 */
export async function unwrapPasswordEnvelope(
  envelope: PasswordEnvelope,
  password: string,
): Promise<Bytes> {
  const key = await importAesKey(
    await wrapKeyFromPassword(password, envelope.salt, envelope.params),
  );
  return open(key, envelope.wrappedRoot);
}

// The framed envelope is padded to RECOVERY_ENVELOPE_SIZE (the contract mirror of the
// Go RecoveryEnvelopeSize), so a stored envelope and a decoy on a miss are the same
// length on the wire (doc 32). The header is self-describing (lengths precede the variable
// fields) so a future salt or wrapped-root size opens without a format bump: a
// version byte, three uint32 KDF params, then length-prefixed salt and wrapped root,
// zero-padded to the fixed size.
const VERSION_BYTE = 1;
const HEADER_FIXED_BYTES = 1 + 4 + 4 + 4; // version + memoryKiB + iterations + parallelism

/**
 * Frame an envelope into exactly RECOVERY_ENVELOPE_SIZE bytes for storage. The
 * layout is `version || memoryKiB || iterations || parallelism || saltLen || salt ||
 * wrappedLen || wrappedRoot || zero-fill`, all integers big-endian. The zero-fill
 * hides the true content length inside the fixed block, exactly as the server's
 * fixed-size decoy does, so a stored envelope is indistinguishable from a decoy.
 */
function writeParams(view: DataView, params: Argon2Params): void {
  view.setUint32(1, params.memoryKiB, false);
  view.setUint32(5, params.iterations, false);
  view.setUint32(9, params.parallelism, false);
}

export function serializeEnvelope(envelope: PasswordEnvelope): Bytes {
  const { params, salt, wrappedRoot } = envelope;
  const saltStart = HEADER_FIXED_BYTES + 1;
  const wrappedLenAt = saltStart + salt.length;
  const wrappedStart = wrappedLenAt + 2;
  if (wrappedStart + wrappedRoot.length > RECOVERY_ENVELOPE_SIZE) {
    throw new Error("serializeEnvelope: envelope exceeds the fixed size");
  }
  const out = new Uint8Array(RECOVERY_ENVELOPE_SIZE);
  const view = new DataView(out.buffer);
  out[0] = VERSION_BYTE;
  writeParams(view, params);
  out[HEADER_FIXED_BYTES] = salt.length;
  out.set(salt, saltStart);
  view.setUint16(wrappedLenAt, wrappedRoot.length, false);
  out.set(wrappedRoot, wrappedStart);
  return out;
}

/**
 * Parse a framed envelope back out of its fixed-size block, the inverse of
 * {@link serializeEnvelope}. It validates the version and that the declared field
 * lengths stay within the block, throwing on anything malformed (a decoy a wrong
 * locator returned, or a truncated blob), so a bad fetch fails closed rather than
 * yielding a bogus envelope.
 */
function readParams(view: DataView): Argon2Params {
  return {
    version: 1,
    memoryKiB: view.getUint32(1, false),
    iterations: view.getUint32(5, false),
    parallelism: view.getUint32(9, false),
  };
}

export function deserializeEnvelope(bytes: Bytes): PasswordEnvelope {
  if (bytes.length !== RECOVERY_ENVELOPE_SIZE) {
    throw new Error("deserializeEnvelope: wrong block size");
  }
  if (bytes[0] !== VERSION_BYTE) {
    throw new Error("deserializeEnvelope: unknown version");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const saltLen = bytes[HEADER_FIXED_BYTES] ?? 0;
  const saltStart = HEADER_FIXED_BYTES + 1;
  const wrappedLenAt = saltStart + saltLen;
  if (wrappedLenAt + 2 > RECOVERY_ENVELOPE_SIZE) {
    throw new Error("deserializeEnvelope: salt length out of range");
  }
  const wrappedStart = wrappedLenAt + 2;
  const wrappedLen = view.getUint16(wrappedLenAt, false);
  if (wrappedStart + wrappedLen > RECOVERY_ENVELOPE_SIZE) {
    throw new Error("deserializeEnvelope: wrapped length out of range");
  }
  return {
    params: readParams(view),
    salt: bytes.slice(saltStart, wrappedLenAt),
    wrappedRoot: bytes.slice(wrappedStart, wrappedStart + wrappedLen),
  };
}

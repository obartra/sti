/**
 * Authenticated encryption for the blind boundary (WebCrypto AES-256-GCM).
 *
 * Two shapes:
 *
 * - {@link sealToSize}/{@link openSized} produce a FIXED-length payload. Alias
 *   payloads must all be the same size so the server can pad real ciphertext and
 *   generate decoys at one length (`AliasPayloadSize`, 4096), making existence
 *   undetectable. The plaintext length is hidden inside the fixed block: we frame
 *   it as `uint32(len) || plaintext || zero-fill` and encrypt the whole frame, so
 *   two different plaintexts of different lengths still encrypt to identical-size
 *   output.
 * - {@link seal}/{@link open} are variable-length, for the account-sync blob,
 *   which is addressed by a key-derived id and is not existence-sensitive.
 *
 * Wire layout for both: `iv(12) || ciphertext+tag`. GCM authenticates, so a wrong
 * key or any tampering makes {@link open}/{@link openSized} reject (throw), which
 * the resolution layer maps to a `null` (uniform) result rather than a leak.
 */

import type { Bytes } from "./encoding.ts";

const IV_BYTES = 12;
const GCM_TAG_BYTES = 16;
const LENGTH_PREFIX_BYTES = 4;

/** Import 32 raw bytes as an AES-GCM key. */
export function importAesKey(raw: Bytes): Promise<CryptoKey> {
  if (raw.length !== 32) {
    throw new Error(`importAesKey: expected 32 bytes, got ${raw.length}`);
  }
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

async function gcmSeal(key: CryptoKey, plaintext: Bytes): Promise<Bytes> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext),
  );
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return out;
}

async function gcmOpen(key: CryptoKey, payload: Bytes): Promise<Bytes> {
  if (payload.length < IV_BYTES + GCM_TAG_BYTES) {
    throw new Error("open: payload too short");
  }
  // slice (not subarray) so iv/ct are backed by their own ArrayBuffer.
  const iv = payload.slice(0, IV_BYTES);
  const ct = payload.slice(IV_BYTES);
  return new Uint8Array(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct),
  );
}

/** Variable-length seal for the account blob: `iv || ciphertext+tag`. */
export function seal(key: CryptoKey, plaintext: Bytes): Promise<Bytes> {
  return gcmSeal(key, plaintext);
}

export function open(key: CryptoKey, payload: Bytes): Promise<Bytes> {
  return gcmOpen(key, payload);
}

/** The maximum plaintext that fits in a fixed payload of `size` bytes. */
export function maxPlaintextForSize(size: number): number {
  return size - IV_BYTES - GCM_TAG_BYTES - LENGTH_PREFIX_BYTES;
}

/**
 * Encrypt `plaintext` into exactly `size` bytes, hiding its true length. The
 * frame `uint32BE(len) || plaintext || zero-fill` is padded to the fixed inner
 * capacity before encryption, so output size is constant regardless of plaintext.
 */
export async function sealToSize(
  key: CryptoKey,
  plaintext: Bytes,
  size: number,
): Promise<Bytes> {
  const innerCapacity = size - IV_BYTES - GCM_TAG_BYTES;
  const maxPlain = innerCapacity - LENGTH_PREFIX_BYTES;
  if (plaintext.length > maxPlain) {
    throw new Error(
      `sealToSize: plaintext ${plaintext.length} exceeds capacity ${maxPlain} for size ${size}`,
    );
  }
  const frame = new Uint8Array(innerCapacity);
  new DataView(frame.buffer).setUint32(0, plaintext.length, false);
  frame.set(plaintext, LENGTH_PREFIX_BYTES);
  const out = await gcmSeal(key, frame);
  // gcmSeal prepends a 12-byte IV; frame -> innerCapacity + 16 tag, so total is
  // exactly `size`. Assert it so a constant drift fails loudly, not silently.
  if (out.length !== size) {
    throw new Error(`sealToSize: produced ${out.length}, expected ${size}`);
  }
  return out;
}

/** Inverse of {@link sealToSize}: decrypt and strip the length frame. */
export async function openSized(
  key: CryptoKey,
  payload: Bytes,
): Promise<Bytes> {
  const frame = await gcmOpen(key, payload);
  if (frame.length < LENGTH_PREFIX_BYTES) {
    throw new Error("openSized: frame too short");
  }
  const len = new DataView(
    frame.buffer,
    frame.byteOffset,
    frame.byteLength,
  ).getUint32(0, false);
  if (len > frame.length - LENGTH_PREFIX_BYTES) {
    throw new Error("openSized: framed length exceeds payload");
  }
  return frame.slice(LENGTH_PREFIX_BYTES, LENGTH_PREFIX_BYTES + len);
}

/**
 * ECIES for the in-app grant (doc 13, slice 2). When a viewer knocks, they send a
 * per-knock ephemeral PUBLIC key and keep the private key locally. To approve, the
 * owner seals the alias's decryption key TO that public key and writes the result
 * to a blind grant slot; the requester opens it with their private key and can
 * then resolve the alias. The server only ever moves the opaque sealed bytes, so
 * it never learns the key, the pairing, or that a grant happened.
 *
 * Construction: ephemeral ECDH(P-256) -> HKDF-SHA256 -> AES-256-GCM (the existing
 * seal/open). The sealed blob is `ephemeralPublicKey(raw 65) || iv || ct+tag`, so
 * it is self-describing: the opener needs only its own private key.
 */

import {
  bytesToBase64url,
  base64urlToBytes,
  utf8ToBytes,
  type Bytes,
} from "./encoding.ts";
import { importAesKey, seal, open, sealToSize, openSized } from "./payload.ts";

const CURVE: EcKeyGenParams = { name: "ECDH", namedCurve: "P-256" };
// An uncompressed P-256 point: 0x04 || X(32) || Y(32).
const RAW_PUBKEY_BYTES = 65;
// Domain separation so this derived key is never confused with another context.
const HKDF_INFO = utf8ToBytes("sti-grant-v1");

/** A serializable grant keypair: base64url raw public + pkcs8 private. */
export interface GrantKeyPair {
  /** Raw P-256 point, sent with the knock. */
  readonly publicKey: string;
  /** pkcs8, kept locally by the requester; never sent. */
  readonly privateKey: string;
}

// HKDF the ECDH shared secret into a fresh AES-GCM key. Both sides derive the
// same key from (their private, the other's public).
async function deriveAesKey(
  privateKey: CryptoKey,
  publicKey: CryptoKey,
): Promise<CryptoKey> {
  const shared = await crypto.subtle.deriveBits(
    { name: "ECDH", public: publicKey },
    privateKey,
    256,
  );
  const hkdf = await crypto.subtle.importKey("raw", shared, "HKDF", false, [
    "deriveBits",
  ]);
  const aesRaw = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: HKDF_INFO },
    hkdf,
    256,
  );
  return importAesKey(new Uint8Array(aesRaw));
}

/** Mint a per-knock keypair. The requester sends `publicKey`, keeps `privateKey`. */
export async function generateGrantKeyPair(): Promise<GrantKeyPair> {
  const kp = await crypto.subtle.generateKey(CURVE, true, ["deriveBits"]);
  const pub = new Uint8Array(
    await crypto.subtle.exportKey("raw", kp.publicKey),
  );
  const priv = new Uint8Array(
    await crypto.subtle.exportKey("pkcs8", kp.privateKey),
  );
  return {
    publicKey: bytesToBase64url(pub),
    privateKey: bytesToBase64url(priv),
  };
}

// Owner side: generate a throwaway keypair, derive the shared AES key to the
// recipient, and return both that key and the raw ephemeral public bytes to
// prepend to the output (the opener needs them to re-derive the same key).
async function deriveSealKey(
  recipientPublicKey: string,
): Promise<{ aesKey: CryptoKey; ephemeralPub: Uint8Array }> {
  const recipientPub = await crypto.subtle.importKey(
    "raw",
    base64urlToBytes(recipientPublicKey),
    CURVE,
    false,
    [],
  );
  const ephemeral = await crypto.subtle.generateKey(CURVE, true, [
    "deriveBits",
  ]);
  const aesKey = await deriveAesKey(ephemeral.privateKey, recipientPub);
  const ephemeralPub = new Uint8Array(
    await crypto.subtle.exportKey("raw", ephemeral.publicKey),
  );
  return { aesKey, ephemeralPub };
}

// Requester side: split off the prepended ephemeral public key, then derive the
// same AES key from (my private, that ephemeral public). Returns the key plus the
// remaining ciphertext to decrypt.
async function deriveOpenKey(
  sealed: Bytes,
  privateKey: string,
): Promise<{ aesKey: CryptoKey; ciphertext: Bytes }> {
  if (sealed.length <= RAW_PUBKEY_BYTES) {
    throw new Error("grant: sealed payload too short");
  }
  const ephemeralPub = await crypto.subtle.importKey(
    "raw",
    sealed.slice(0, RAW_PUBKEY_BYTES),
    CURVE,
    false,
    [],
  );
  const myPriv = await crypto.subtle.importKey(
    "pkcs8",
    base64urlToBytes(privateKey),
    CURVE,
    false,
    ["deriveBits"],
  );
  const aesKey = await deriveAesKey(myPriv, ephemeralPub);
  return { aesKey, ciphertext: sealed.slice(RAW_PUBKEY_BYTES) };
}

function prepend(ephemeralPub: Uint8Array, payload: Bytes): Bytes {
  const out = new Uint8Array(ephemeralPub.length + payload.length);
  out.set(ephemeralPub, 0);
  out.set(payload, ephemeralPub.length);
  return out;
}

/** Owner side: seal `secret` so only the holder of `recipientPublicKey` can open it. */
export async function sealToPublicKey(
  secret: Bytes,
  recipientPublicKey: string,
): Promise<Bytes> {
  const { aesKey, ephemeralPub } = await deriveSealKey(recipientPublicKey);
  return prepend(ephemeralPub, await seal(aesKey, secret));
}

/** Requester side: open a sealed grant with the private key kept from the knock. */
export async function openFromPrivateKey(
  sealed: Bytes,
  privateKey: string,
): Promise<Bytes> {
  const { aesKey, ciphertext } = await deriveOpenKey(sealed, privateKey);
  return open(aesKey, ciphertext);
}

/**
 * Like {@link sealToPublicKey} but the output is exactly `size` bytes, so a grant
 * is indistinguishable in length from any alias payload when parked in the blind
 * store. The inner secret is sealed to (size - the 65-byte ephemeral key) via the
 * length-hiding {@link sealToSize}; the ephemeral public key is prepended.
 */
export async function sealToPublicKeySized(
  secret: Bytes,
  recipientPublicKey: string,
  size: number,
): Promise<Bytes> {
  const { aesKey, ephemeralPub } = await deriveSealKey(recipientPublicKey);
  const payload = await sealToSize(aesKey, secret, size - RAW_PUBKEY_BYTES);
  return prepend(ephemeralPub, payload);
}

/** Inverse of {@link sealToPublicKeySized}. Throws on a wrong key or any tampering
 * (the GCM tag), which the caller treats as "not granted to me / not yet granted". */
export async function openFromPrivateKeySized(
  sealed: Bytes,
  privateKey: string,
): Promise<Bytes> {
  const { aesKey, ciphertext } = await deriveOpenKey(sealed, privateKey);
  return openSized(aesKey, ciphertext);
}

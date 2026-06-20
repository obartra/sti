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
import { importAesKey, seal, open } from "./payload.ts";

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

/** Owner side: seal `secret` so only the holder of `recipientPublicKey` can open it. */
export async function sealToPublicKey(
  secret: Bytes,
  recipientPublicKey: string,
): Promise<Bytes> {
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
  const payload = await seal(aesKey, secret);
  const ephemeralPub = new Uint8Array(
    await crypto.subtle.exportKey("raw", ephemeral.publicKey),
  );
  const out = new Uint8Array(ephemeralPub.length + payload.length);
  out.set(ephemeralPub, 0);
  out.set(payload, ephemeralPub.length);
  return out;
}

/** Requester side: open a sealed grant with the private key kept from the knock. */
export async function openFromPrivateKey(
  sealed: Bytes,
  privateKey: string,
): Promise<Bytes> {
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
  return open(aesKey, sealed.slice(RAW_PUBKEY_BYTES));
}

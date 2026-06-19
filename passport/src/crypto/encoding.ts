/**
 * Byte <-> string encodings for the crypto boundary.
 *
 * base64url (RFC 4648 §5, no padding) is the wire shape of every opaque id and
 * of any byte payload we carry as text. It matches the server's id alphabet
 * (`[A-Za-z0-9_-]`), so an id we generate here is one the server accepts.
 *
 * These are pure and have no key material; the actual encrypt/decrypt lives in
 * payload.ts and the derivations in keys.ts.
 */

/**
 * The byte type the crypto layer uses everywhere. Pinning the backing buffer to
 * `ArrayBuffer` (not `ArrayBufferLike`, which also admits `SharedArrayBuffer`)
 * keeps every value assignable to WebCrypto's `BufferSource` under strict TS.
 */
export type Bytes = Uint8Array<ArrayBuffer>;

const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder();

export function utf8ToBytes(s: string): Bytes {
  return utf8Encoder.encode(s);
}

export function bytesToUtf8(bytes: Bytes): string {
  return utf8Decoder.decode(bytes);
}

/** Encode bytes as base64url without padding. */
export function bytesToBase64url(bytes: Bytes): string {
  let binary = "";
  // Chunk to stay well under the argument-count limit of String.fromCharCode.
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Decode a base64url string (with or without padding) back to bytes. Throws on
 * input that is not valid base64url, so a malformed id fails loudly rather than
 * silently decoding to garbage.
 */
export function base64urlToBytes(s: string): Bytes {
  if (!/^[A-Za-z0-9_-]*={0,2}$/.test(s)) {
    throw new Error("base64urlToBytes: input is not base64url");
  }
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

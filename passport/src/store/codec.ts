/**
 * Shared building blocks for the wire codecs (publicCard, accountBlob). The
 * fail-closed parse preamble lives here once so the security-load-bearing
 * invariant, any structural surprise throws and the store maps that to the
 * uniform null/gray, cannot drift between the two codecs.
 */

import { bytesToUtf8, type Bytes } from "../crypto/index.ts";

export const MAX_HANDLE_LEN = 64;

export function isValidHandle(x: unknown): x is string {
  return typeof x === "string" && x.length > 0 && x.length <= MAX_HANDLE_LEN;
}

/**
 * Parse decrypted bytes as a versioned JSON object. Throws unless it is a
 * non-null object whose `v` exactly equals `version`. Returns the raw record for
 * the caller to validate field by field.
 */
export function decodeVersioned(
  bytes: Bytes,
  version: number,
): Record<string, unknown> {
  const raw: unknown = JSON.parse(bytesToUtf8(bytes));
  if (typeof raw !== "object" || raw === null) {
    throw new Error("wire: not an object");
  }
  const o = raw as Record<string, unknown>;
  if (o.v !== version) {
    throw new Error(`wire: unsupported version ${String(o.v)}`);
  }
  return o;
}

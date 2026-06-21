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

// Parse bytes to a non-null JSON object, or throw. Shared so the "any structural
// surprise throws" preamble can't drift between the version checks below.
function decodeObject(bytes: Bytes): Record<string, unknown> {
  const raw: unknown = JSON.parse(bytesToUtf8(bytes));
  if (typeof raw !== "object" || raw === null) {
    throw new Error("wire: not an object");
  }
  return raw as Record<string, unknown>;
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
  const o = decodeObject(bytes);
  if (o.v !== version) {
    throw new Error(`wire: unsupported version ${String(o.v)}`);
  }
  return o;
}

/**
 * Like {@link decodeVersioned} but accepts any integer version in 1..=maxVersion,
 * for a schema whose newer versions only ADD optional fields (so an older payload
 * still parses). The caller validates the version-specific fields. A version above
 * maxVersion, below 1, or non-integer throws (fail closed).
 */
export function decodeVersionedUpTo(
  bytes: Bytes,
  maxVersion: number,
): Record<string, unknown> {
  const o = decodeObject(bytes);
  const v = o.v;
  if (
    typeof v !== "number" ||
    !Number.isInteger(v) ||
    v < 1 ||
    v > maxVersion
  ) {
    throw new Error(`wire: unsupported version ${String(v)}`);
  }
  return o;
}

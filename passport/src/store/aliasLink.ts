/**
 * Parse a shared passport URL into an {@link AliasLink}. A public link is
 * `/a/{id}#k={key}`: the opaque read id is in the path (reaches the server), the
 * decryption key is in the fragment (never sent). A private link carries no
 * `#k=` and cannot be resolved publicly, so it returns null (the viewer sees the
 * uniform gray-nothing until a knock/claim flow, handled in a later slice).
 *
 * Pure and total: any URL that is not a well-formed public alias link is null.
 */

import { validId } from "../api/contract.ts";
import type { AliasLink } from "./passportStore.ts";

const ALIAS_PATH = /^\/a\/([^/]+)\/?$/;

export function parseAliasLink(
  pathname: string,
  hash: string,
): AliasLink | null {
  const match = ALIAS_PATH.exec(pathname);
  const id = match?.[1];
  if (id === undefined || !validId(id)) return null;

  const key = new URLSearchParams(hash.replace(/^#/, "")).get("k");
  // The key is a 32-byte AES key, so it has the same 43-char base64url shape as
  // an id; reject anything else rather than feed garbage to the crypto layer.
  if (key === null || !validId(key)) return null;

  return { id, key };
}

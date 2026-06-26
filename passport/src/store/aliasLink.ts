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

/**
 * The opaque alias id from a `/a/{id}` path, or null if the path is not a
 * well-formed alias link. A keyless link is still a real link (the gated "ask
 * first" share, doc 16); it just carries no decryption key, so callers route it
 * to the ask-to-view flow rather than treating it as not-a-link.
 */
export function aliasIdFromPath(pathname: string): string | null {
  const id = ALIAS_PATH.exec(pathname)?.[1];
  return id !== undefined && validId(id) ? id : null;
}

export function parseAliasLink(
  pathname: string,
  hash: string,
): AliasLink | null {
  const id = aliasIdFromPath(pathname);
  if (id === null) return null;

  const key = new URLSearchParams(hash.replace(/^#/, "")).get("k");
  // The key is a 32-byte AES key, so it has the same 43-char base64url shape as
  // an id; reject anything else rather than feed garbage to the crypto layer.
  if (key === null || !validId(key)) return null;

  return { id, key };
}

// The canonical site host that share links are built against.
const SITE_HOST = "sti.care";

/**
 * Parse the text decoded from a scanned QR into an {@link AliasLink}. A scanned
 * code is untrusted input, so this is deliberately strict: it must be a full URL
 * to our own site (the canonical host, or `selfHost` for same-origin testing),
 * and its path + fragment must be a well-formed public alias link. Anything else
 * (a different host, a non-link URL, junk, a private/keyless link) is null, so a
 * malicious QR can never redirect the viewer off-site. Pure and total.
 */
export function parseScannedLink(
  text: string,
  selfHost?: string,
): AliasLink | null {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    return null;
  }
  if (url.host !== SITE_HOST && url.host !== selfHost) return null;
  return parseAliasLink(url.pathname, url.hash);
}

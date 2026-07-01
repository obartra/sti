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

/**
 * Parse the text decoded from a scanned QR into an {@link AliasLink}. A scanned
 * code is untrusted input, so this is deliberately strict about SHAPE: the text
 * must be a full URL whose path + fragment is a well-formed public alias link
 * (`/a/{id}#k={key}`), or it is null. Anything that is not that shape (a non-link
 * URL, junk, a private/keyless link) is rejected.
 *
 * The host is deliberately NOT gated. A generated link always carries the
 * canonical `sti.care` host (SHARE_ORIGIN), but a real deployment is reached
 * through preview and staging hosts too, and only the id + key in the link
 * matter: resolution runs against OUR own api regardless of the link's host, and
 * the viewer is never navigated to the scanned URL's host (we open the parsed
 * id/key inside our own resolution flow, never window.location = url). So a
 * cross-host or preview link still resolves, while a scanned QR still cannot
 * redirect anyone off-site. Pure and total.
 */
export function parseScannedLink(text: string): AliasLink | null {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    return null;
  }
  return parseAliasLink(url.pathname, url.hash);
}

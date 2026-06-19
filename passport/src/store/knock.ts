/**
 * Knock: a link-holder who can't decrypt a private alias requests access. The
 * server response is existence-uniform (it never says whether the alias exists),
 * so a knock leaks nothing; the owner reviews it out of band.
 *
 * The requester hash is a stable, opaque token per (requester device, alias): it
 * lets the server dedupe and rate-limit a requester's knocks on one alias without
 * learning who they are. The requester secret is a per-device random the caller
 * keeps locally; it names no one.
 */

import type { ApiClient } from "../api/client.ts";
import { sha256Base64url, utf8ToBytes } from "../crypto/index.ts";

export function requesterHash(
  requesterSecret: string,
  aliasId: string,
): Promise<string> {
  // Length-prefix the secret so the framing is unambiguous regardless of what
  // the secret contains: distinct (secret, id) pairs can never hash the same
  // input even if a secret happens to hold the separator.
  return sha256Base64url(
    utf8ToBytes(`${requesterSecret.length}:${requesterSecret}:${aliasId}`),
  );
}

/** Knock on an alias. Resolves regardless of whether the alias exists. */
export async function knock(
  api: ApiClient,
  aliasId: string,
  requesterSecret: string,
): Promise<void> {
  await api.knock(aliasId, await requesterHash(requesterSecret, aliasId));
}

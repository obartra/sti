/**
 * In-app Approve: the owner grants a knocking requester read access to a private
 * alias WITHOUT handing over an out-of-band link (doc 13, slice 2).
 *
 * The flow rides the existing blind /a store: the server never sees an identity,
 * the alias read key, or the card. The steps:
 *  - When the requester knocked they sent an ephemeral public key and kept the
 *    private half locally (see crypto/grant + store/knock).
 *  - To approve, the owner seals the alias's read key TO that public key and PUTs
 *    it to a GRANT SLOT: an opaque /a id derived from (aliasId, requesterHash).
 *    Both sides can derive the slot id, but a third party can't (they'd need both
 *    the alias id and the requester's hash), and to the server it is just another
 *    4096-byte alias payload.
 *  - The requester polls that slot, opens it with their stored private key to get
 *    the alias read key, and then resolves the alias normally.
 *
 * Residual metadata (doc 13 §limits): the knock is POST /knock/{aliasId} carrying
 * the requesterHash, so the server already holds (aliasId, requesterHash) and can
 * recompute the slot id and notice the owner's PUT to it. It thus learns "this
 * knock was answered", but nothing more: both values are opaque tokens, the key is
 * sealed under ECIES, and the card stays encrypted. Hiding even that linkage would
 * need a shared secret the server never sees, which the pre-grant requester does
 * not have; it is left as an accepted residual rather than chased.
 *
 * Failing safe: an un-granted slot reads as a decoy (existence-uniform), and a
 * grant for someone else won't open, so {@link redeemGrant} returns null rather
 * than throwing in either case. The owner can re-approve idempotently because the
 * slot's write token is derived deterministically too.
 */

import type { ApiClient, PendingKnock } from "../api/client.ts";
import { ALIAS_PAYLOAD_SIZE } from "../api/contract.ts";
import {
  sha256Base64url,
  utf8ToBytes,
  base64urlToBytes,
  bytesToBase64url,
  sealToPublicKeySized,
  openFromPrivateKeySized,
} from "../crypto/index.ts";
import type { AliasRecord } from "./accountBlob.ts";
import { requesterHash } from "./knock.ts";

// Domain-separated derivations so a grant slot id / write token can never collide
// with another opaque value or be reused across contexts.
const SLOT_INFO = "sti-grant-slot-v1";
const WTOKEN_INFO = "sti-grant-wtoken-v1";

/** The opaque /a id holding a grant for (aliasId, requesterHash). Both the owner
 * and that one requester can derive it; no one else can. */
export function deriveGrantSlotId(
  aliasId: string,
  requesterHashValue: string,
): Promise<string> {
  return sha256Base64url(
    utf8ToBytes(`${SLOT_INFO}:${aliasId}:${requesterHashValue}`),
  );
}

// The grant slot's write token, derived from the alias's own write token (which
// only the owner holds) so re-approving overwrites the slot in place instead of
// hitting a 403 on a second PUT.
function deriveGrantWriteToken(
  aliasWriteToken: string,
  requesterHashValue: string,
): Promise<string> {
  return sha256Base64url(
    utf8ToBytes(`${WTOKEN_INFO}:${aliasWriteToken}:${requesterHashValue}`),
  );
}

/**
 * Owner side: seal `alias`'s read key to a pending requester's ephemeral key and
 * write it to the grant slot. The requester can then open it and resolve `alias`.
 * Throws if the pending knock carried no key (nothing to seal to).
 */
export async function grantAccess(
  api: ApiClient,
  alias: AliasRecord,
  pending: PendingKnock,
): Promise<void> {
  if (!pending.pubKey) {
    throw new Error("grant: requester sent no key to seal to");
  }
  const slotId = await deriveGrantSlotId(alias.id, pending.requesterHash);
  const writeToken = await deriveGrantWriteToken(
    alias.writeToken,
    pending.requesterHash,
  );
  const sealed = await sealToPublicKeySized(
    base64urlToBytes(alias.key),
    pending.pubKey,
    ALIAS_PAYLOAD_SIZE,
  );
  await api.putAlias(slotId, sealed, writeToken);
}

/**
 * Requester side: poll the grant slot for `aliasId`. Returns the alias read key
 * (base64url, ready for resolveAlias) once the owner has approved, or null while
 * it is still pending or if the slot is not a grant meant for this device. The
 * caller supplies the private key it kept when it knocked.
 */
export async function redeemGrant(
  api: ApiClient,
  aliasId: string,
  requesterSecret: string,
  grantPrivateKey: string,
): Promise<string | null> {
  const hash = await requesterHash(requesterSecret, aliasId);
  const slotId = await deriveGrantSlotId(aliasId, hash);
  // getAlias always returns a fixed-size payload (a decoy when nothing is there),
  // so a still-pending grant is indistinguishable from a miss on the wire. It is
  // OUTSIDE the try on purpose: a transport/protocol error must propagate, not be
  // mistaken for "pending".
  const sealed = await api.getAlias(slotId);
  try {
    return bytesToBase64url(
      await openFromPrivateKeySized(sealed, grantPrivateKey),
    );
  } catch {
    // The only failures here are crypto: a decoy (not yet granted) or a grant
    // sealed to someone else. Both mean "no key for me" -> null, never an error.
    return null;
  }
}

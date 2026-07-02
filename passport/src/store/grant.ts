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
  type Bytes,
} from "../crypto/index.ts";
import type { AliasRecord } from "./accountBlob.ts";
import { requesterHash } from "./knock.ts";

// Domain-separated derivations so a grant slot id / write token can never collide
// with another opaque value or be reused across contexts.
const SLOT_INFO = "sti-grant-slot-v1";
const WTOKEN_INFO = "sti-grant-wtoken-v1";

// Length-prefix each component (like requesterHash in knock.ts) so the framing is
// unambiguous regardless of what a component holds: distinct splits can never hash
// the same input even if a value contains the separator. The components are
// fixed-length opaque tokens today, so this is defense-in-depth that keeps the
// derivation robust if any of them ever became variable-length.
function framed(...parts: string[]): string {
  return parts.map((p) => `${p.length}:${p}`).join("");
}

/** The opaque /a id holding a grant for (aliasId, requesterHash). Both the owner
 * and that one requester can derive it; no one else can. */
export function deriveGrantSlotId(
  aliasId: string,
  requesterHashValue: string,
): Promise<string> {
  return sha256Base64url(
    utf8ToBytes(framed(SLOT_INFO, aliasId, requesterHashValue)),
  );
}

// The grant slot's write token, derived from the owner's own write token (the alias
// write token, or a group's join-pointer write token) so re-approving overwrites the
// slot in place instead of hitting a 403 on a second PUT. Shared by grantAccess and
// the group join-grant path (doc 33, slice 4b), which derives the same way off the
// join pointer.
function deriveGrantWriteToken(
  aliasWriteToken: string,
  requesterHashValue: string,
): Promise<string> {
  return sha256Base64url(
    utf8ToBytes(framed(WTOKEN_INFO, aliasWriteToken, requesterHashValue)),
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

/**
 * Group join-grant, owner side (doc 33, slice 4b): approving a request to join a
 * public group is delivering an invite to the requester over the grant channel.
 * This is {@link grantAccess} generalized: instead of sealing an alias read key at
 * an alias, it seals an OPAQUE payload (a JSON invite, {@link encodeJoinGrant}) at
 * the group's public JOIN POINTER, deriving the slot + write token off the pointer
 * exactly as grantAccess does off an alias. The requester polls the slot and opens
 * it with {@link redeemJoinGrant}. Throws if the pending request carried no key.
 *
 * The join pointer stays keyless and statusless (its own payload is a pure decoy):
 * this rides its knock/grant capability, it does not turn the pointer into a card.
 */
export async function sealGroupJoinGrant(
  api: ApiClient,
  join: { pointerId: string; writeToken: string },
  pending: PendingKnock,
  payload: Bytes,
): Promise<void> {
  if (!pending.pubKey) {
    throw new Error("join grant: requester sent no key to seal to");
  }
  const slotId = await deriveGrantSlotId(join.pointerId, pending.requesterHash);
  const writeToken = await deriveGrantWriteToken(
    join.writeToken,
    pending.requesterHash,
  );
  const sealed = await sealToPublicKeySized(
    payload,
    pending.pubKey,
    ALIAS_PAYLOAD_SIZE,
  );
  await api.putAlias(slotId, sealed, writeToken);
}

/**
 * Group join-grant, requester side (doc 33, slice 4b): poll the grant slot at the
 * public join pointer for `pointerId` and open it with the private key kept from the
 * knock. Returns the opaque grant plaintext (a sealed invite, for {@link
 * parseJoinGrant}) once the admin has approved, or null while still pending / if the
 * slot is not sealed to this device, exactly like {@link redeemGrant}. The getAlias
 * is OUTSIDE the try on purpose: a transport error must propagate, not read as
 * "pending".
 */
export async function redeemJoinGrant(
  api: ApiClient,
  pointerId: string,
  requesterSecret: string,
  grantPrivateKey: string,
): Promise<Bytes | null> {
  const hash = await requesterHash(requesterSecret, pointerId);
  const slotId = await deriveGrantSlotId(pointerId, hash);
  const sealed = await api.getAlias(slotId);
  try {
    return await openFromPrivateKeySized(sealed, grantPrivateKey);
  } catch {
    // A decoy (not yet approved) or a grant sealed to someone else: no grant for
    // this device -> null, never an error.
    return null;
  }
}

/**
 * The open door's server plumbing (doc 25 "the door stays open"): every open
 * completion screen is its holder's own door, an opaque knock pointer a newcomer
 * scans and knocks at. Each admitted leg runs the existing knock/grant channel:
 * the holder seals a fresh contact invite plus a fresh one-shot return inbox to
 * the arrival's key; the joiner completes its side and answers through that
 * inbox. Every leg is pairwise-sealed end to end; there is no shared room key,
 * and nothing new exists for the server (knocks, sealed grants, and alias-shaped
 * existence-uniform blobs).
 *
 * This module is deliberately SESSION-FREE: it moves sealed bytes and derives
 * slots. Minting the fresh contact, accepting the invite, and ingesting the
 * return are the existing session ops; the linkup screen composes the two.
 */

import type { ApiClient, PendingKnock } from "../api/client.ts";
import { ALIAS_PAYLOAD_SIZE } from "../api/contract.ts";
import { randomAliasId, randomWriteToken } from "../crypto/index.ts";
import type { ContactInvite } from "./contactInvite.ts";
import { browserGrantKeyStore, type GrantKeyStore } from "./grantKeyStore.ts";
import { sealGroupJoinGrant, redeemJoinGrant } from "./grant.ts";
import { knock } from "./knock.ts";
import {
  encodeDoorGrant,
  encodeDoorReturn,
  parseDoorGrant,
  parseDoorReturn,
  type DoorGrant,
} from "./linkup.ts";
import { pollInbox, writePing, type InboxCapability } from "./notifyInbox.ts";
import { browserRequesterSecret } from "./requesterStore.ts";

/** One open door: the pointer a newcomer knocks at, and the write token that
 * gates its review + grants. The token never leaves this device. */
export interface DoorHandle {
  readonly pointerId: string;
  readonly writeToken: string;
}

export interface DoorStore {
  /** Open a door: bind a fresh keyless, statusless decoy pointer. */
  open(): Promise<DoorHandle>;
  /** Close the door: overwrite the decoy so the pointer is dead. Knocks at a
   * photographed code then land nowhere (nobody reviews them). */
  close(door: DoorHandle): Promise<void>;
  /** The grantable arrivals waiting at the door (those that carried a key). */
  arrivals(door: DoorHandle): Promise<PendingKnock[]>;
  /** Admit one arrival: seal the fresh bundle + return channel to their key. */
  admit(
    door: DoorHandle,
    arrival: PendingKnock,
    grant: DoorGrant,
  ): Promise<void>;
  /** Poll one admitted leg's return channel for the joiner's answer. */
  pollReturn(returnInbox: InboxCapability): Promise<ContactInvite | null>;
  /** Joiner: knock at a scanned door with this device's ephemeral key. */
  knock(pointerId: string): Promise<void>;
  /** Joiner: poll for the holder's sealed grant; null while still pending. */
  redeem(pointerId: string): Promise<DoorGrant | null>;
  /** Joiner: answer through the grant's return channel with the return invite. */
  sendReturn(returnInbox: InboxCapability, returnUrl: string): Promise<void>;
}

/**
 * @param requesterSecret the device's stable knock secret (the same one the
 * viewer knock path uses); tests inject a volatile one.
 * @param grantKeys the per-pointer ephemeral keypair store; tests inject an
 * in-memory one.
 */
export function createDoorStore(
  api: ApiClient,
  requesterSecret: string = browserRequesterSecret(),
  grantKeys: GrantKeyStore = browserGrantKeyStore(),
): DoorStore {
  return {
    async open() {
      const door = {
        pointerId: randomAliasId(),
        writeToken: randomWriteToken(),
      };
      // A pure decoy PUT binds the write token; the pointer stays keyless and
      // statusless, so anyone resolving it sees the uniform gray-nothing.
      await api.putAlias(
        door.pointerId,
        crypto.getRandomValues(new Uint8Array(ALIAS_PAYLOAD_SIZE)),
        door.writeToken,
      );
      return door;
    },

    async close(door) {
      // Overwrite in place (same as a revoke): best-effort, the door is gone
      // either way once the holder stops reviewing it.
      await api
        .putAlias(
          door.pointerId,
          crypto.getRandomValues(new Uint8Array(ALIAS_PAYLOAD_SIZE)),
          door.writeToken,
        )
        .catch(() => undefined);
    },

    async arrivals(door) {
      const review = await api
        .knockReview(door.pointerId, door.writeToken)
        .catch(() => ({ count: 0, pending: [] }));
      return review.pending.filter((p) => Boolean(p.pubKey));
    },

    admit(door, arrival, grant) {
      return sealGroupJoinGrant(
        api,
        { pointerId: door.pointerId, writeToken: door.writeToken },
        arrival,
        encodeDoorGrant(grant),
      );
    },

    async pollReturn(returnInbox) {
      const bytes = await pollInbox(api, returnInbox);
      return bytes === null ? null : parseDoorReturn(bytes);
    },

    async knock(pointerId) {
      const kp = await grantKeys.forAlias(pointerId);
      await knock(api, pointerId, requesterSecret, kp.publicKey);
    },

    async redeem(pointerId) {
      const privateKey = grantKeys.privateKey(pointerId);
      if (privateKey === null) return null;
      try {
        const sealed = await redeemJoinGrant(
          api,
          pointerId,
          requesterSecret,
          privateKey,
        );
        return sealed === null ? null : parseDoorGrant(sealed);
      } catch {
        // A transport error reads as "still pending"; the poll simply retries.
        return null;
      }
    },

    sendReturn(returnInbox, returnUrl) {
      return writePing(api, returnInbox, encodeDoorReturn(returnUrl));
    },
  };
}

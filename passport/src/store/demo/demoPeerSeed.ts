/**
 * Demo seed for the scripted second party (doc 28 F): the simulated counterpart that
 * lets a lone reviewer complete, on one device with no server, the flows that
 * normally need another account. Plain in-memory fixtures plus one small stateful
 * store the demo runtime returns, faithful to the real shapes; the peer auto-responds
 * (auto/scripted): a pending ask is grant-shaped, a viewer's knock resolves after a
 * beat. No api client and no network (the demoContract no-fetch invariant).
 */

import type { ResolvedView } from "../../ui/public/PublicResolution.tsx";
import type { AliasRecord, StatusAlias } from "../accountBlob.ts";
import { mintNotify, type NotifyCapability } from "../notifyInbox.ts";
import { randomAliasId, randomWriteToken } from "../../crypto/keys.ts";
import { todayEpochDay } from "../../core/clock.ts";

/** The exchanged halves that make a demo contact read as a real two-way connection
 * (doc 13): the peer's read-only status alias and notify capability, plus the owner's
 * own per-contact inbox. All synthetic and never polled (no server). */
export function demoTwoWay(): {
  theirStatusAlias: StatusAlias;
  theirNotify: NotifyCapability;
  myInbox: NotifyCapability;
} {
  return {
    theirStatusAlias: { id: randomAliasId(), key: randomAliasId() },
    theirNotify: mintNotify(),
    myInbox: mintNotify(),
  };
}

/** A stable AliasRecord standing in for one link the owner shared, that the scripted
 * stranger knocked on (Flow 1, grant a knock). Public, so it needs a grant. */
export function demoSharedAlias(): AliasRecord {
  return {
    id: randomAliasId(),
    writeToken: randomWriteToken(),
    key: randomAliasId(),
    isPublic: true,
  };
}

/**
 * Flow 3 (knock as a viewer): the viewer's own outbound requests. Seeds ONE waiting
 * request (a gray peer the reviewer already asked to see), so the Requests surface has
 * a live "waiting" row; each redeem resolves it after one more poll (the scripted owner
 * approves), flipping it to a status card. A fresh knock on the seeded gray link joins
 * the same store. `isGray` lets the read store return the uniform gray-nothing (null)
 * for the seeded link so, if it is opened directly, the knock affordance shows.
 */
export function demoViewerRequestStore(peerCard: ResolvedView): {
  grayId: string;
  pending: () => { readonly id: string; readonly at: number }[];
  isGray: (id: string) => boolean;
  knock: (id: string) => void;
  redeem: (id: string) => ResolvedView | null;
  forget: (id: string) => void;
} {
  const grayId = randomAliasId();
  // id -> epoch day the request was made (drives the Requests list).
  const asked = new Map<string, number>([[grayId, todayEpochDay()]]);
  // id -> how many times redeem has run; the scripted owner "approves" on the 2nd,
  // so the viewer sees a brief "waiting" before it resolves.
  const polls = new Map<string, number>();
  return {
    grayId,
    pending: () => [...asked.entries()].map(([id, at]) => ({ id, at })),
    isGray: (id) => id === grayId,
    knock: (id) => {
      if (!asked.has(id)) asked.set(id, todayEpochDay());
      polls.set(id, 0);
    },
    redeem: (id) => {
      if (!asked.has(id)) return null;
      const n = (polls.get(id) ?? 0) + 1;
      polls.set(id, n);
      return n >= 2 ? peerCard : null;
    },
    forget: (id) => {
      asked.delete(id);
      polls.delete(id);
    },
  };
}

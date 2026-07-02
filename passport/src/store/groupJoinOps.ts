/**
 * The shared-group REQUEST path plus LEAVE (doc 33, slice 4b): the member-initiated
 * half of the membership lifecycle, built on the invite machinery of slice 4a.
 *
 * The key insight the reviewed design turns on: a request's back-half is IDENTICAL
 * to an invite's. Approving a request just means "deliver an invite to the requester
 * over the grant channel", after which the requester runs the SAME accept back-half
 * (acceptGroupInvite) an invited member runs, and the admin ingests the accept via
 * the same pollGroupLifecycle. So this file reuses, never re-rolls: the knock/grant/
 * requester primitives (doc 13) carry the request and its approval, and the invite
 * codec + accept op carry the join itself.
 *
 * The blind boundary holds throughout. A request is a uniform 202 knock at the
 * group's public join pointer (the server learns only an opaque (pointerId,
 * requesterHash) pair, exactly as for an alias knock). An approval is a sealed grant
 * parked at a derived slot (opaque fixed-size ciphertext). A reject writes NOTHING to
 * the server (a server-side rejection signal would be a new oracle for no benefit);
 * it is remembered device-locally and the knock self-expires. Pre-membership request
 * state stays device-local (groupJoinStore), never in the synced blob. Every read
 * fails CLOSED, so nothing new is observable.
 */

import type { ApiClient } from "../api/client.ts";
import type { AccountManager } from "./account.ts";
import type { GroupRecord, PendingGroupInvite } from "./accountBlob.ts";
import type { OwnerSession } from "./session.ts";
import type { GrantKeyStore } from "./grantKeyStore.ts";
import type { GroupJoinStore } from "./groupJoinStore.ts";
import { knock } from "./knock.ts";
import { sealGroupJoinGrant, redeemJoinGrant } from "./grant.ts";
import {
  encodeJoinGrant,
  parseJoinGrant,
  encodeLifecycleLeave,
  type GroupInvite,
} from "./groupInvite.ts";
import { mintInbox, writePing } from "./notifyInbox.ts";
import { acceptGroupInvite } from "./groupMembershipOps.ts";
import { revokeAlias } from "./publish.ts";
import {
  base64urlToBytes,
  randomAliasId,
  type Bytes,
} from "../crypto/index.ts";
import type { GroupKey } from "./groupCrypto.ts";
import { parseGroupBlobWithKg, GROUP_MEMBER_CAP } from "./groupObject.ts";
import { ALIAS_PAYLOAD_SIZE } from "../api/contract.ts";
import { todayEpochDay } from "../core/clock.ts";
import { normalizeVanityName } from "./vanityName.ts";

/**
 * The device-local capabilities the request path needs (doc 13 primitives, reused):
 * the per-device requester secret, the per-pointer grant keypair store, and the
 * device-local pending-join / dismissed store. Bundled so the ops stay within the
 * parameter-count ceiling.
 */
export interface JoinRequesterDeps {
  readonly requesterSecret: string;
  readonly grantKeys: GrantKeyStore;
  readonly joinStore: GroupJoinStore;
}

/** How a request resolved: `requested` (the knock landed), or `not-found` when the
 * handle does not resolve to a public group. Uniform: a private group or an unknown
 * handle both surface `not-found`, so neither leaks whether a group exists. */
export type RequestResult = "requested" | "not-found";

/** One waiting request an admin can act on: the opaque requester token and the
 * ephemeral key their grant is sealed to. Only requests that carried a key (so an
 * invite can be delivered) surface here. */
export interface PendingRequest {
  readonly requesterHash: string;
  readonly pubKey: string;
}

// The admin's own record for a group, or undefined when the owner is not its admin.
function adminGroup(
  session: OwnerSession,
  groupId: string,
): GroupRecord | undefined {
  return session.blob.groups?.find((g) => g.groupId === groupId && g.isAdmin);
}

/**
 * REQUEST (member-initiated, public groups only): resolve the handle to its join
 * pointer, then knock there carrying this device's grant public key (so the admin
 * can seal an invite back), and record the request device-locally so a return visit
 * can redeem an approval. A handle that does not resolve to a public group fails
 * closed to `not-found` (no leak). The knock is always a uniform 202.
 */
export async function requestToJoin(
  api: ApiClient,
  deps: JoinRequesterDeps,
  handle: string,
): Promise<RequestResult> {
  const name = normalizeVanityName(handle);
  const pointerId = await api.resolveVanityName(name).catch(() => null);
  if (pointerId === null) return "not-found";
  const kp = await deps.grantKeys.forAlias(pointerId);
  await knock(api, pointerId, deps.requesterSecret, kp.publicKey);
  deps.joinStore.addPending(pointerId, name);
  return "requested";
}

// Bind (or re-bind) a write token at the join pointer (doc 33, slice 4b touch-up):
// a public group created before this bound no token there, so knockReview would
// 403. A pure decoy PUT under joinWriteToken establishes the capability. Idempotent
// and self-healing (re-binds a fresh decoy under the same token every review); the
// pointer stays a keyless, statusless decoy, so a resolver still sees gray-nothing.
async function bindJoinPointer(
  api: ApiClient,
  pointerId: string,
  writeToken: string,
): Promise<void> {
  await api.putAlias(
    pointerId,
    crypto.getRandomValues(new Uint8Array(ALIAS_PAYLOAD_SIZE)),
    writeToken,
  );
}

/**
 * REVIEW (admin): the waiting join requests for a public group the owner admins.
 * Binds the join-pointer token first (the touch-up/backfill above), reviews the
 * knocks there, keeps only the grantable ones (those that carried a key), and hides
 * any the admin has locally dismissed. Best-effort: an unreachable pointer reviews
 * empty. A non-public group (no join pointer) has no requests.
 */
export async function reviewJoinRequests(
  api: ApiClient,
  joinStore: GroupJoinStore,
  session: OwnerSession,
  groupId: string,
): Promise<PendingRequest[]> {
  const group = adminGroup(session, groupId);
  if (
    group?.joinPointerId === undefined ||
    group.joinWriteToken === undefined
  ) {
    return [];
  }
  await bindJoinPointer(api, group.joinPointerId, group.joinWriteToken).catch(
    () => undefined,
  );
  const review = await api
    .knockReview(group.joinPointerId, group.joinWriteToken)
    .catch(() => ({ count: 0, pending: [] }));
  return review.pending.flatMap((p): PendingRequest[] =>
    p.pubKey && !joinStore.isDismissed(groupId, p.requesterHash)
      ? [{ requesterHash: p.requesterHash, pubKey: p.pubKey }]
      : [],
  );
}

/**
 * APPROVE REQUEST (admin) = deliver an invite over the grant channel. Cap-check the
 * live roster (a full group is not granted, fail clean), then mint a lifecycle inbox
 * and record a pending invite (the SAME shape and op an admin invite uses), and seal
 * the invite to the requester at the join pointer's grant slot. The admin ingests the
 * eventual accept via the existing pollGroupLifecycle. Order is fail-safe: record the
 * pending invite (so its inbox is polled) BEFORE sealing the grant. A no-op for a
 * non-admin / non-public / unreadable group.
 */
export async function approveJoinRequest(
  api: ApiClient,
  accounts: AccountManager,
  session: OwnerSession,
  opts: { groupId: string; request: PendingRequest },
): Promise<OwnerSession> {
  const group = adminGroup(session, opts.groupId);
  if (
    group?.joinPointerId === undefined ||
    group.joinWriteToken === undefined
  ) {
    return session;
  }
  if (group.kg === undefined) return session;
  const Kg = base64urlToBytes(group.kg) as GroupKey;
  const obj = await parseGroupBlobWithKg(
    await api.getGroupBlob(group.groupId),
    Kg,
  );
  if (obj === null || obj.roster.length >= GROUP_MEMBER_CAP) return session;
  const lifecycleInbox = mintInbox();
  const invite: PendingGroupInvite = {
    inviteId: randomAliasId(),
    lifecycleInbox,
    createdDay: todayEpochDay(),
  };
  const blob = await accounts.recordPendingInvite(
    session.root,
    group.groupId,
    invite,
  );
  const groupInvite: GroupInvite = {
    groupId: group.groupId,
    lifecycleInbox,
    handle: group.handle,
    visibility: group.visibility,
    meetingKind: group.meetingKind,
  };
  await sealGroupJoinGrant(
    api,
    { pointerId: group.joinPointerId, writeToken: group.joinWriteToken },
    opts.request,
    encodeJoinGrant(groupInvite),
  );
  return { root: session.root, blob };
}

/**
 * REJECT REQUEST (admin): hide the request from future reviews. No server write (a
 * server-side rejection would be a new oracle for no benefit); the requester's knock
 * self-expires (KnockTTL). The session is unchanged (nothing synced is touched).
 */
export function rejectJoinRequest(
  joinStore: GroupJoinStore,
  session: OwnerSession,
  opts: { groupId: string; requesterHash: string },
): OwnerSession {
  joinStore.dismiss(opts.groupId, opts.requesterHash);
  return session;
}

/**
 * REDEEM + ACCEPT (requester): for each device-local pending join, poll the grant
 * slot; on a sealed invite, run the SAME accept back-half an invited member runs, and
 * clear the pending join. Fail-closed: a still-pending / not-mine / garbage slot, or
 * a device that never knocked here, leaves the request pending for the next visit.
 */
export async function redeemJoinRequests(
  api: ApiClient,
  accounts: AccountManager,
  deps: JoinRequesterDeps,
  session: OwnerSession,
): Promise<OwnerSession> {
  const ctx: RedeemCtx = { api, accounts, deps };
  let current = session;
  for (const pending of deps.joinStore.listPending()) {
    current = await redeemOnePending(ctx, current, pending.pointerId);
  }
  return current;
}

// The fixed context one redeem pass needs, bundled so the per-pointer helper stays
// within the parameter-count ceiling.
interface RedeemCtx {
  readonly api: ApiClient;
  readonly accounts: AccountManager;
  readonly deps: JoinRequesterDeps;
}

// Poll and act on one pending join. A device that never knocked this pointer has no
// stored key (null private key), so it is skipped; a null redeem (still pending or
// not sealed to us) or a null parse (garbage) leaves the request pending.
async function redeemOnePending(
  ctx: RedeemCtx,
  session: OwnerSession,
  pointerId: string,
): Promise<OwnerSession> {
  const privateKey = ctx.deps.grantKeys.privateKey(pointerId);
  if (privateKey === null) return session;
  try {
    const sealed: Bytes | null = await redeemJoinGrant(
      ctx.api,
      pointerId,
      ctx.deps.requesterSecret,
      privateKey,
    );
    if (sealed === null) return session;
    const invite = parseJoinGrant(sealed);
    if (invite === null) return session;
    const next = await acceptGroupInvite(
      ctx.api,
      ctx.accounts,
      session,
      invite,
    );
    ctx.deps.joinStore.removePending(pointerId);
    return next;
  } catch {
    return session;
  }
}

/**
 * LEAVE (self, member): tell the admin we left over the admin<->member channel we
 * kept from accept, gray out our own group card immediately (revoke = no future
 * reads, doc 01), and drop the local record. The admin's pollGroupLifecycle sees the
 * leave and drops us from the roster, byte-identical to an admin remove (doc 33). No
 * `Kg` rotation here (slice 5): we keep the copy we hold; that seam is intentional. A
 * no-op when the group is unknown or we are its admin (an admin removes/deletes, not
 * leaves) or we hold no lifecycle channel.
 */
export async function leaveGroup(
  api: ApiClient,
  accounts: AccountManager,
  session: OwnerSession,
  groupId: string,
): Promise<OwnerSession> {
  const group = session.blob.groups?.find(
    (g) => g.groupId === groupId && !g.isAdmin,
  );
  if (group?.lifecycleInbox === undefined) return session;
  await writePing(api, group.lifecycleInbox, encodeLifecycleLeave());
  await revokeAlias(api, {
    id: group.myCardId,
    writeToken: group.myCardWriteToken,
  });
  const blob = await accounts.dropGroup(session.root, groupId);
  return { root: session.root, blob };
}

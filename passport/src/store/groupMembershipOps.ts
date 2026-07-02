/**
 * The shared-group membership lifecycle (doc 33, slice 4a): the INVITE side. Like
 * the other owner ops (groupOps, findableOps) these are free functions over the api
 * + account manager, called by the session controller's thin method wrappers.
 *
 * This file covers invite / accept / reject / revoke, remove, and the member read/
 * roster poll. The admin's INGEST of an accept/reject/leave (fill a slot, grow or
 * shrink the roster) lives in groupIngestOps (split out for length), and the request
 * side + leave are groupJoinOps (slice 4b). Remove (and a leave, via the ingest that
 * reuses it) ROTATES the group key (doc 33, slice 5): the admin mints a fresh `Kg'`,
 * re-wraps it to the surviving members (using each retained member key), and re-seals
 * the core, so the departed member's copy of the old `Kg` opens nothing new. Every
 * remaining member recovers `Kg'` and republishes on their next read.
 *
 * The blind boundary holds throughout: the invite URL carries capabilities only in
 * its fragment (never to a server, exactly like the contact invite); the accept/
 * reject rides an existence-uniform inbox; nothing but opaque ciphertext reaches the
 * server. Every read fails CLOSED (a null poll or a null parse leaves an invite
 * pending, indistinguishable from an empty/decoy inbox), so no new oracle appears.
 */

import type { ApiClient } from "../api/client.ts";
import { ALIAS_PAYLOAD_SIZE } from "../api/contract.ts";
import type { AccountManager } from "./account.ts";
import type { GroupRecord, PendingGroupInvite } from "./accountBlob.ts";
import type { OwnerSession } from "./session.ts";
import {
  base64urlToBytes,
  bytesToBase64url,
  deriveGroupMemberKey,
  deriveGroupNotify,
  randomAliasId,
  randomWriteToken,
  type Bytes,
  type RootKey,
} from "../crypto/index.ts";
import { todayEpochDay } from "../core/clock.ts";
import {
  mintGroupKey,
  openGroupCard,
  wrapGroupKey,
  type GroupKey,
} from "./groupCrypto.ts";
import {
  parseGroupBlobForMember,
  parseGroupBlobWithKg,
  serializeGroupBlob,
  type GroupObject,
} from "./groupObject.ts";
import {
  encodeLifecycleAccept,
  encodeLifecycleReject,
  groupInviteUrl,
  type GroupInvite,
} from "./groupInvite.ts";
import {
  mintInbox,
  writePing,
  type InboxCapability,
  type NotifyCapability,
} from "./notifyInbox.ts";
import { publishGroupCard } from "./groupOps.ts";
import type { ResolvedView } from "../ui/public/PublicResolution.tsx";

/** The session after an invite plus the link to hand the invitee. */
export interface GroupInviteResult {
  readonly session: OwnerSession;
  readonly url: string;
}

/** One roster row as a reader sees it: the card id, the opened card (null = gray/
 * absent, the honest fallback when a member has not published under the live key),
 * and whether this row is the admin or the reader themselves. */
export interface RosterMemberView {
  readonly cardId: string;
  readonly card: ResolvedView | null;
  readonly isAdmin: boolean;
  readonly isSelf: boolean;
}

/**
 * A roster read (doc 33). `session` is returned because a member's first successful
 * read caches `Kg` onto their record (a persistence side effect), so the caller must
 * keep the updated session; `obj` is null when the reader cannot open the group yet
 * (a member the admin has not added, or an unreadable/decoy blob), in which case the
 * roster is empty.
 */
export interface GroupRosterView {
  readonly session: OwnerSession;
  readonly obj: GroupObject | null;
  readonly members: RosterMemberView[];
}

// The admin's own record for a group, or undefined when the owner is not its admin.
// Exported for the ingest ops (groupIngestOps), which resolve the same record.
export function adminGroup(
  session: OwnerSession,
  groupId: string,
): GroupRecord | undefined {
  return session.blob.groups?.find((g) => g.groupId === groupId && g.isAdmin);
}

// Overwrite an inbox with fresh random bytes of the fixed size, so any prior payload
// (a not-yet-ingested accept) can never be opened again. Byte-shape identical to a
// normal sealed write, so it adds no oracle; the admin holds the write token.
// Exported for the ingest ops (groupIngestOps), which reuse it on a reject.
export async function overwriteInbox(
  api: ApiClient,
  inbox: InboxCapability,
): Promise<void> {
  const random = crypto.getRandomValues(new Uint8Array(ALIAS_PAYLOAD_SIZE));
  await api.putInbox(inbox.inboxId, random, inbox.writeToken);
}

/**
 * INVITE (admin): mint a fresh lifecycle inbox, record the pending invite under the
 * group, and build the invite URL (all capabilities in the fragment). No server call
 * in this front-half; the admin ingests the eventual accept via pollGroupLifecycle.
 */
export async function inviteToGroup(
  accounts: AccountManager,
  session: OwnerSession,
  opts: { groupId: string; label?: string },
): Promise<GroupInviteResult> {
  const group = adminGroup(session, opts.groupId);
  if (group === undefined) {
    throw new Error("inviteToGroup: not an admin of this group");
  }
  const lifecycleInbox = mintInbox();
  const invite: PendingGroupInvite = {
    inviteId: randomAliasId(),
    lifecycleInbox,
    createdDay: todayEpochDay(),
    ...(opts.label !== undefined ? { label: opts.label } : {}),
  };
  const blob = await accounts.recordPendingInvite(
    session.root,
    group.groupId,
    invite,
  );
  const url = groupInviteUrl({
    groupId: group.groupId,
    lifecycleInbox,
    handle: group.handle,
    visibility: group.visibility,
    meetingKind: group.meetingKind,
  });
  return { session: { root: session.root, blob }, url };
}

/**
 * REVOKE (admin, pre-accept): overwrite the lifecycle inbox FIRST (killing any
 * accept the invitee may already have written but the admin has not ingested), then
 * drop the pending invite. Fail-safe order: if the drop failed, the inbox is already
 * dead. A no-op when the invite is unknown.
 */
export async function revokeGroupInvite(
  api: ApiClient,
  accounts: AccountManager,
  session: OwnerSession,
  opts: { groupId: string; inviteId: string },
): Promise<OwnerSession> {
  const group = adminGroup(session, opts.groupId);
  const invite = group?.pendingInvites?.find(
    (p) => p.inviteId === opts.inviteId,
  );
  if (group === undefined || invite === undefined) return session;
  await overwriteInbox(api, invite.lifecycleInbox);
  const blob = await accounts.dropPendingInvite(
    session.root,
    group.groupId,
    invite.inviteId,
  );
  return { root: session.root, blob };
}

/**
 * ACCEPT (invitee): derive our member key (safe to hand the admin: HKDF is one-way
 * and the admin already holds `Kg`), mint a fresh card id + write token, seal + write
 * the accept to the INVITE inbox, and record a local member-side group record. We do
 * NOT publish a card yet (we have no `Kg`); the next roster poll does that once the
 * admin has added our slot. The card write token is NEVER shared, so only we can
 * overwrite our card.
 *
 * The ongoing LEAVE channel is a fresh inbox we mint here, NOT the invite inbox. The
 * invite inbox's write token rode in the shareable invite link, so anyone who ever
 * held that link could write to it; if leave rode there too, an old link-holder could
 * later write `{kind:"leave"}` and get us evicted. So we hand the admin our own leave
 * inbox INSIDE the accept, which writePing seals under the invite inbox key: it never
 * reaches the server in the clear and no bearer link carries its write token. That
 * minted inbox becomes our own `lifecycleInbox` (the channel leaveGroup writes to).
 */
export async function acceptGroupInvite(
  api: ApiClient,
  accounts: AccountManager,
  session: OwnerSession,
  invite: GroupInvite,
): Promise<OwnerSession> {
  const memberKey = await deriveGroupMemberKey(session.root, invite.groupId);
  const cardId = randomAliasId();
  const cardWriteToken = randomWriteToken();
  const leaveInbox = mintInbox();
  await writePing(
    api,
    invite.lifecycleInbox,
    encodeLifecycleAccept(memberKey, cardId, leaveInbox),
  );
  const group: GroupRecord = {
    groupId: invite.groupId,
    myCardId: cardId,
    myCardWriteToken: cardWriteToken,
    lifecycleInbox: leaveInbox,
    handle: invite.handle,
    visibility: invite.visibility,
    meetingKind: invite.meetingKind,
    isAdmin: false,
  };
  const blob = await accounts.recordJoinedGroup(session.root, group);
  return { root: session.root, blob };
}

/**
 * REJECT (invitee): write a reject to the lifecycle inbox so the admin drops the
 * pending invite. We recorded nothing locally on invite, so there is nothing to
 * clean up; the session is returned unchanged.
 */
export async function rejectGroupInvite(
  api: ApiClient,
  session: OwnerSession,
  invite: GroupInvite,
): Promise<OwnerSession> {
  await writePing(api, invite.lifecycleInbox, encodeLifecycleReject());
  return session;
}

/**
 * REMOVE (admin, doc 33 slice 5): removal means NO FUTURE READS, so it rotates the
 * key. The removed member keeps the old `Kg` they already hold (you cannot un-give a
 * key), so simply dropping their slot would still let them open every remaining
 * member's card. Instead the admin mints a fresh `Kg'`, re-wraps it to every SURVIVING
 * member, and re-seals the group core under `Kg'`; the old key now opens nothing new.
 * The roster change (they are no longer listed) is what everyone else sees,
 * indistinguishable from a leave. A no-op when the cardId is not a current member.
 * `ingestMemberLeave` calls this, so a leave rotates identically (no duplicate path).
 */
export async function removeGroupMember(
  api: ApiClient,
  accounts: AccountManager,
  session: OwnerSession,
  opts: { groupId: string; cardId: string },
): Promise<OwnerSession> {
  const group = adminGroup(session, opts.groupId);
  if (group === undefined) return session;
  if (group.kg === undefined || group.groupWriteToken === undefined) {
    return session;
  }
  if (!group.members?.some((m) => m.cardId === opts.cardId)) return session;
  return rotateGroupKey(api, accounts, session, {
    group,
    dropCardId: opts.cardId,
  });
}

// Re-seal the group under a fresh `Kg'` for the surviving membership (doc 33). The
// surviving set is the admin itself (its slot re-wrapped from its own derived member
// key, since `members` never lists the admin) plus every member except the dropped
// one. Roster and wrapped keys are rebuilt in the SAME surviving order (admin first),
// so roster[i] and wrappedKeys[i] line up; a reader trial-unwraps regardless of order,
// so this is for clarity, not correctness. `Kg'` is minted fresh, NEVER derived from
// the old key, so the departed member's copy grants no foothold on the new one.
async function rebuildRotatedBlob(
  root: RootKey,
  group: GroupRecord,
  obj: GroupObject,
  dropCardId: string,
): Promise<{ newKg: GroupKey; nextBlob: Bytes }> {
  const newKg = mintGroupKey();
  const adminMemberKey = await deriveGroupMemberKey(root, group.groupId);
  const survivors = (group.members ?? []).filter(
    (m) => m.cardId !== dropCardId,
  );
  const roster = [
    { cardId: group.myCardId },
    ...survivors.map((m) => ({ cardId: m.cardId })),
  ];
  const wrappedKeys = await Promise.all([
    wrapGroupKey(newKg, adminMemberKey),
    ...survivors.map((m) => wrapGroupKey(newKg, base64urlToBytes(m.memberKey))),
  ]);
  const nextBlob = await serializeGroupBlob(
    newKg,
    { ...obj, roster },
    wrappedKeys,
  );
  return { newKg, nextBlob };
}

// Mint `Kg'`, re-seal the blob to the surviving membership, write it, then bring the
// admin's own state onto the new key: republish its card under `Kg'` (so its color is
// not gray after a rotation) and cache `Kg'` locally while dropping the removed member.
// Fails closed on an unreadable blob (never rotates onto a key it cannot verify). The
// remaining members catch up on their next read (openForReader recovers `Kg'`).
async function rotateGroupKey(
  api: ApiClient,
  accounts: AccountManager,
  session: OwnerSession,
  ctx: { group: GroupRecord; dropCardId: string },
): Promise<OwnerSession> {
  const { group, dropCardId } = ctx;
  const kgB64 = group.kg;
  const writeToken = group.groupWriteToken;
  if (kgB64 === undefined || writeToken === undefined) return session;
  const oldKg = base64urlToBytes(kgB64) as GroupKey;
  const blob = await api.getGroupBlob(group.groupId);
  const obj = await parseGroupBlobWithKg(blob, oldKg);
  if (obj === null) return session;
  const { newKg, nextBlob } = await rebuildRotatedBlob(
    session.root,
    group,
    obj,
    dropCardId,
  );
  await api.putGroupBlob(group.groupId, nextBlob, writeToken);
  await publishGroupCard(api, session.blob.state, newKg, {
    cardId: group.myCardId,
    cardWriteToken: group.myCardWriteToken,
  });
  await accounts.updateGroupKgCache(
    session.root,
    group.groupId,
    bytesToBase64url(newKg),
  );
  const next = await accounts.dropGroupMember(
    session.root,
    group.groupId,
    dropCardId,
  );
  return { root: session.root, blob: next };
}

/**
 * READ / ROSTER (member or admin): fetch the blob, open it (an admin/holder with the
 * cached `Kg`, or a member by trial-unwrap), then open every roster card under `Kg`.
 * A member's first successful open caches `Kg` and publishes their own card (they
 * could not at accept time, holding no `Kg`). Fails closed to an empty roster when
 * the reader cannot open the group yet.
 */
export async function readGroupRoster(
  api: ApiClient,
  accounts: AccountManager,
  session: OwnerSession,
  groupId: string,
): Promise<GroupRosterView> {
  const group = session.blob.groups?.find((g) => g.groupId === groupId);
  if (group === undefined) return { session, obj: null, members: [] };
  const blob = await api.getGroupBlob(groupId).catch(() => null);
  if (blob === null) return { session, obj: null, members: [] };
  const opened = await openForReader(api, accounts, session, { group, blob });
  if (opened === null) return { session, obj: null, members: [] };
  const members = await readRosterCards(api, opened.Kg, opened.obj, group);
  return { session: opened.session, obj: opened.obj, members };
}

/**
 * The group notify targets (doc 33, slice 6): open the group as this reader (fetching
 * the blob fresh and recovering/caching the CURRENT `Kg`, syncing past a rotation),
 * then derive the group-notify channel of every OTHER member in the current roster.
 * These are what a reporter's positive fans out to, as ordinary contentless pings.
 * Both event and recurring groups notify the current roster minus self (there is no
 * membership-history log and the shipped pairwise notify is un-windowed, so the scope
 * is not branched on `meetingKind` here). Fails CLOSED to no targets when the reader
 * cannot open the group (e.g. removed), so a locked-out reporter pings no one. The
 * session is returned because opening may cache `Kg`, a persistence side effect the
 * caller keeps.
 */
export async function groupNotifyTargets(
  api: ApiClient,
  accounts: AccountManager,
  session: OwnerSession,
  groupId: string,
): Promise<{ session: OwnerSession; targets: NotifyCapability[] }> {
  const group = session.blob.groups?.find((g) => g.groupId === groupId);
  if (group === undefined) return { session, targets: [] };
  const blob = await api.getGroupBlob(groupId).catch(() => null);
  if (blob === null) return { session, targets: [] };
  const opened = await openForReader(api, accounts, session, { group, blob });
  if (opened === null) return { session, targets: [] };
  const targets = await Promise.all(
    opened.obj.roster
      .filter((entry) => entry.cardId !== group.myCardId)
      .map((entry) => deriveGroupNotify(opened.Kg, entry.cardId)),
  );
  return { session: opened.session, targets };
}

// Resolve `Kg` + the group object for a reader (doc 33). Fast path: a Kg-holder (the
// admin, or a member who already synced) opens the core directly with the cached key.
// If that cached key no longer opens the core, a rotation happened out from under it
// (removal minted a fresh `Kg'`), so fall through to trial-unwrap and recover the
// current key from our own slot. A member with no cached key yet (first read) also
// trial-unwraps. Either recovery syncs onto the new key. Both the cached key failing
// AND trial-unwrap failing means our slot is gone: we were removed, so null (the
// removed member is correctly locked out to an empty roster).
async function openForReader(
  api: ApiClient,
  accounts: AccountManager,
  session: OwnerSession,
  ctx: { group: GroupRecord; blob: Bytes },
): Promise<{ session: OwnerSession; Kg: GroupKey; obj: GroupObject } | null> {
  const { group, blob } = ctx;
  if (group.kg !== undefined) {
    const Kg = base64urlToBytes(group.kg) as GroupKey;
    const obj = await parseGroupBlobWithKg(blob, Kg);
    if (obj !== null) return { session, Kg, obj };
    // Cached Kg no longer opens the core: fall through to recover the rotated key.
  }
  const memberKey = await deriveGroupMemberKey(session.root, group.groupId);
  const found = await parseGroupBlobForMember(blob, memberKey);
  if (found === null) return null;
  return syncMemberKey(api, accounts, session, { group, ...found });
}

// A member syncing onto a freshly recovered `Kg` (doc 33): their first successful
// read, or a read after a rotation replaced the key their cache held. Both are the
// same act, "I hold a new `Kg`": publish their group card under it (so their color is
// correct under the live key, not gray) and cache it on their record so later reads
// take the fast path. Reaching here means the recovered key differs from any cached
// one (a cached key that still opened the core returned on the fast path above).
async function syncMemberKey(
  api: ApiClient,
  accounts: AccountManager,
  session: OwnerSession,
  ctx: { group: GroupRecord; Kg: GroupKey; obj: GroupObject },
): Promise<{ session: OwnerSession; Kg: GroupKey; obj: GroupObject }> {
  const { group, Kg, obj } = ctx;
  await publishGroupCard(api, session.blob.state, Kg, {
    cardId: group.myCardId,
    cardWriteToken: group.myCardWriteToken,
  });
  const blob = await accounts.updateGroupKgCache(
    session.root,
    group.groupId,
    bytesToBase64url(Kg),
  );
  return { session: { root: session.root, blob }, Kg, obj };
}

// Open every roster card under `Kg`. A card that will not open (never published under
// the live key, unreachable, or a decoy) is null (gray/absent), never a wrong color.
async function readRosterCards(
  api: ApiClient,
  Kg: GroupKey,
  obj: GroupObject,
  group: GroupRecord,
): Promise<RosterMemberView[]> {
  return Promise.all(
    obj.roster.map(async (entry): Promise<RosterMemberView> => {
      const bytes = await api.getAlias(entry.cardId).catch(() => null);
      return {
        cardId: entry.cardId,
        card: bytes === null ? null : await openGroupCard(Kg, bytes),
        isAdmin: entry.cardId === obj.adminCardId,
        isSelf: entry.cardId === group.myCardId,
      };
    }),
  );
}

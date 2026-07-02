/**
 * The shared-group membership lifecycle (doc 33, slice 4a): the INVITE side. Like
 * the other owner ops (groupOps, findableOps) these are free functions over the api
 * + account manager, called by the session controller's thin method wrappers.
 *
 * This slice covers invite / accept / reject / revoke, the admin's ingest of an
 * acceptance (fill a slot, grow the roster), remove, and the member read/roster
 * poll. The request side (knock/grant), leave, and key rotation on remove are later
 * slices; a removed member keeps the old `Kg` for now (correct until rotation lands),
 * which is why each member's member key is retained (so `Kg` can be re-wrapped then).
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
import type {
  GroupMemberSecret,
  GroupRecord,
  PendingGroupInvite,
} from "./accountBlob.ts";
import type { OwnerSession } from "./session.ts";
import {
  base64urlToBytes,
  bytesToBase64url,
  deriveGroupMemberKey,
  randomAliasId,
  randomWriteToken,
  type Bytes,
} from "../crypto/index.ts";
import { todayEpochDay } from "../core/clock.ts";
import { openGroupCard, wrapGroupKey, type GroupKey } from "./groupCrypto.ts";
import {
  addMemberSlot,
  dropMemberSlot,
  parseGroupBlobForMember,
  parseGroupBlobWithKg,
  GROUP_MEMBER_CAP,
  type GroupObject,
} from "./groupObject.ts";
import {
  encodeLifecycleAccept,
  encodeLifecycleReject,
  groupInviteUrl,
  parseLifecyclePayload,
  type GroupInvite,
  type LifecycleAccept,
} from "./groupInvite.ts";
import {
  mintInbox,
  pollInbox,
  writePing,
  type InboxCapability,
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
function adminGroup(
  session: OwnerSession,
  groupId: string,
): GroupRecord | undefined {
  return session.blob.groups?.find((g) => g.groupId === groupId && g.isAdmin);
}

// Overwrite an inbox with fresh random bytes of the fixed size, so any prior payload
// (a not-yet-ingested accept) can never be opened again. Byte-shape identical to a
// normal sealed write, so it adds no oracle; the admin holds the write token.
async function overwriteInbox(
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
 * the accept to the lifecycle inbox, and record a local member-side group record. We
 * do NOT publish a card yet (we have no `Kg`); the next roster poll does that once
 * the admin has added our slot. The card write token is NEVER shared, so only we can
 * overwrite our card.
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
  await writePing(
    api,
    invite.lifecycleInbox,
    encodeLifecycleAccept(memberKey, cardId),
  );
  const group: GroupRecord = {
    groupId: invite.groupId,
    myCardId: cardId,
    myCardWriteToken: cardWriteToken,
    lifecycleInbox: invite.lifecycleInbox,
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

// Every (groupId, inviteId) the admin currently has pending, as a flat snapshot
// taken before ingest (each is re-resolved against the latest session inside the
// loop, so a mutation from an earlier pair is seen by a later one).
function pendingRefs(
  session: OwnerSession,
): { groupId: string; inviteId: string }[] {
  const out: { groupId: string; inviteId: string }[] = [];
  for (const g of session.blob.groups ?? []) {
    if (!g.isAdmin) continue;
    for (const p of g.pendingInvites ?? []) {
      out.push({ groupId: g.groupId, inviteId: p.inviteId });
    }
  }
  return out;
}

/**
 * ADMIN INGEST (poll every pending invite's lifecycle inbox). A null poll or a null
 * parse leaves the invite pending (indistinguishable from an empty/decoy inbox); an
 * accept fills a slot + grows the roster (idempotently); a reject drops the invite.
 */
export async function pollGroupLifecycle(
  api: ApiClient,
  accounts: AccountManager,
  session: OwnerSession,
): Promise<OwnerSession> {
  let current = session;
  for (const ref of pendingRefs(session)) {
    current = await ingestPending(api, accounts, current, ref);
  }
  return current;
}

// Poll and act on one pending invite. Fail-closed: an unreadable/decoy inbox or a
// network blip leaves it pending for the next poll.
async function ingestPending(
  api: ApiClient,
  accounts: AccountManager,
  session: OwnerSession,
  ref: { groupId: string; inviteId: string },
): Promise<OwnerSession> {
  const group = adminGroup(session, ref.groupId);
  const invite = group?.pendingInvites?.find(
    (p) => p.inviteId === ref.inviteId,
  );
  if (group === undefined || invite === undefined) return session;
  try {
    const raw = await pollInbox(api, invite.lifecycleInbox);
    if (raw === null) return session;
    const payload = parseLifecyclePayload(raw);
    if (payload === null) return session;
    if (payload.kind === "reject") {
      return await rejectPending(api, accounts, session, { group, invite });
    }
    return await ingestAccept(api, accounts, session, {
      group,
      invite,
      accept: payload,
    });
  } catch {
    return session;
  }
}

// A reject: overwrite the inbox and drop the pending invite.
async function rejectPending(
  api: ApiClient,
  accounts: AccountManager,
  session: OwnerSession,
  ctx: { group: GroupRecord; invite: PendingGroupInvite },
): Promise<OwnerSession> {
  await overwriteInbox(api, ctx.invite.lifecycleInbox);
  const blob = await accounts.dropPendingInvite(
    session.root,
    ctx.group.groupId,
    ctx.invite.inviteId,
  );
  return { root: session.root, blob };
}

// An accept: add the member's slot to the blob (unless already there) and promote
// the pending invite to a roster member. Idempotent: an already-ingested cardId is a
// no-op; a blob that already has the slot (a prior partial run) skips the re-add and
// just promotes. A full group leaves the invite pending (fail clean, no drop), so it
// can be ingested once a removal frees a slot.
async function ingestAccept(
  api: ApiClient,
  accounts: AccountManager,
  session: OwnerSession,
  ctx: {
    group: GroupRecord;
    invite: PendingGroupInvite;
    accept: LifecycleAccept;
  },
): Promise<OwnerSession> {
  const { group, invite, accept } = ctx;
  if (group.members?.some((m) => m.cardId === accept.cardId)) return session;
  if (group.kg === undefined || group.groupWriteToken === undefined) {
    return session;
  }
  const Kg = base64urlToBytes(group.kg) as GroupKey;
  const blob = await api.getGroupBlob(group.groupId);
  const obj = await parseGroupBlobWithKg(blob, Kg);
  if (obj === null) return session;
  if (!obj.roster.some((r) => r.cardId === accept.cardId)) {
    if (obj.roster.length >= GROUP_MEMBER_CAP) return session;
    await addAcceptToBlob(api, {
      groupId: group.groupId,
      writeToken: group.groupWriteToken,
      blob,
      Kg,
      accept,
    });
  }
  const member: GroupMemberSecret = {
    cardId: accept.cardId,
    memberKey: accept.memberKey,
    lifecycleInbox: invite.lifecycleInbox,
  };
  const next = await accounts.promoteInviteToMember(
    session.root,
    group.groupId,
    invite.inviteId,
    member,
  );
  return { root: session.root, blob: next };
}

// Wrap `Kg` to the accepting member's key, lay it into a free slot, and write the
// grown blob back under the group write token.
async function addAcceptToBlob(
  api: ApiClient,
  ctx: {
    groupId: string;
    writeToken: string;
    blob: Bytes;
    Kg: GroupKey;
    accept: LifecycleAccept;
  },
): Promise<void> {
  const wrapped = await wrapGroupKey(
    ctx.Kg,
    base64urlToBytes(ctx.accept.memberKey),
  );
  const nextBlob = await addMemberSlot(
    ctx.blob,
    ctx.Kg,
    ctx.accept.cardId,
    wrapped,
  );
  await api.putGroupBlob(ctx.groupId, nextBlob, ctx.writeToken);
}

/**
 * REMOVE (admin): drop the member's slot + roster entry from the blob and drop the
 * roster secret locally. No `Kg` rotation (slice 5), so the removed member keeps the
 * copy of `Kg` they already hold; the roster change (they are no longer listed) is
 * what everyone else sees, indistinguishable from a leave. A no-op when the cardId is
 * not a current member.
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
  const Kg = base64urlToBytes(group.kg) as GroupKey;
  const blob = await api.getGroupBlob(group.groupId);
  const nextBlob = await dropMemberSlot(blob, Kg, opts.cardId);
  await api.putGroupBlob(group.groupId, nextBlob, group.groupWriteToken);
  const next = await accounts.dropGroupMember(
    session.root,
    group.groupId,
    opts.cardId,
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

// Resolve `Kg` + the group object for a reader: a Kg-holder (admin, or a member who
// already cached it) opens the core directly; a member without it trial-unwraps. On a
// member's first success, cache Kg + publish their card. Null when unopenable.
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
    return obj === null ? null : { session, Kg, obj };
  }
  const memberKey = await deriveGroupMemberKey(session.root, group.groupId);
  const found = await parseGroupBlobForMember(blob, memberKey);
  if (found === null) return null;
  return firstMemberRead(api, accounts, session, { group, ...found });
}

// A member's first successful read: publish their group card under the freshly
// recovered `Kg`, cache `Kg` on their record, and return the updated session.
async function firstMemberRead(
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

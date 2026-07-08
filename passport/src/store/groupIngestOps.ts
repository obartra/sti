/**
 * The admin's ingest of the shared-group membership lifecycle (doc 33, slices 4a +
 * 4b), split out of groupMembershipOps so each stays within its length ceiling. An
 * admin polls, per group they run, every pending invite's lifecycle inbox and every
 * member's, and reconciles the group blob + local roster to what it finds:
 *
 * - An ACCEPT (on an invite inbox, from either an invited member or an approved
 *   requester, whose back-halves are identical) fills a free slot and grows the
 *   roster, idempotently, then promotes the pending invite to a member.
 * - A REJECT (on an invite inbox) overwrites the inbox and drops the pending invite.
 * - A LEAVE (on a member inbox) drops that member exactly as a remove does, so the
 *   observable (the roster shrinks, no reason) is byte-identical to an admin remove
 *   (doc 33): leaving and being removed are indistinguishable to the rest of the
 *   group. Because it reuses `removeGroupMember`, a leave ROTATES the key too (slice
 *   5): the departed member keeps their copy of the old `Kg` but it opens nothing new.
 *
 * Every read fails CLOSED: a null poll, a null parse, or an unreadable blob leaves
 * the state unchanged (an invite pending, a member in place), indistinguishable from
 * an empty/decoy inbox, so the ingest adds no oracle.
 */

import type { ApiClient } from "../api/client.ts";
import type { AccountManager } from "./account.ts";
import type {
  GroupMemberSecret,
  GroupRecord,
  PendingGroupInvite,
} from "./accountBlob.ts";
import type { OwnerSession } from "./session.ts";
import { base64urlToBytes, type Bytes } from "../crypto/index.ts";
import { wrapGroupKey, type GroupKey } from "./groupCrypto.ts";
import {
  addMemberSlot,
  parseGroupBlobWithKg,
  GROUP_MEMBER_CAP,
} from "./groupObject.ts";
import type { LifecycleAccept } from "./groupInvite.ts";
import {
  adminGroup,
  overwriteInbox,
  pollLifecyclePayload,
  removeGroupMember,
} from "./groupMembershipOps.ts";

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
 * ADMIN INGEST (poll every pending invite's lifecycle inbox, then every member's).
 * A null poll or a null parse leaves an invite pending (indistinguishable from an
 * empty/decoy inbox); an accept fills a slot + grows the roster (idempotently); a
 * reject drops the invite; a member's `leave` drops that member (doc 33, slice 4b),
 * byte-identical to an admin remove.
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
  for (const ref of memberRefs(current)) {
    current = await ingestMemberLeave(api, accounts, current, ref);
  }
  return current;
}

// Every (groupId, cardId) an admin currently has a member for, as a flat snapshot
// taken before ingest (each is re-resolved against the latest session inside the
// loop, so a drop from an earlier pair is seen by a later one). The shape matches
// removeGroupMember's opts, so a ref can be handed to it directly.
function memberRefs(
  session: OwnerSession,
): { groupId: string; cardId: string }[] {
  return (session.blob.groups ?? [])
    .filter((g) => g.isAdmin)
    .flatMap((g) =>
      (g.members ?? []).map((m) => ({ groupId: g.groupId, cardId: m.cardId })),
    );
}

// Poll one member's lifecycle inbox and, on a `leave`, drop them exactly as a remove
// does. Fail-closed: an empty/decoy inbox, a stale accept still sitting there, or a
// network blip leaves the member in place. Idempotent (a dropped member is no longer
// in memberRefs).
async function ingestMemberLeave(
  api: ApiClient,
  accounts: AccountManager,
  session: OwnerSession,
  ref: { groupId: string; cardId: string },
): Promise<OwnerSession> {
  const member = adminGroup(session, ref.groupId)?.members?.find(
    (m) => m.cardId === ref.cardId,
  );
  if (member === undefined) return session;
  try {
    const payload = await pollLifecyclePayload(api, member.lifecycleInbox);
    if (payload?.kind !== "leave") return session;
    return await removeGroupMember(api, accounts, session, ref);
  } catch {
    return session;
  }
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
    const payload = await pollLifecyclePayload(api, invite.lifecycleInbox);
    if (payload === null) return session;
    if (payload.kind === "reject") {
      return await rejectPending(api, accounts, session, { group, invite });
    }
    // A leave only ever rides a MEMBER's inbox (ingestMemberLeave), never an
    // invite inbox; treat anything but an accept here as still-pending (fail closed).
    if (payload.kind !== "accept") return session;
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
  // Poll the member's OWN leave channel (the inbox they minted and delivered inside
  // the sealed accept), never the invite inbox. Only the member and we hold this one's
  // write token, so no old invite-link holder can write a `leave` and evict them. The
  // invite inbox is finished now (its consumed accept carries no leave power), so it is
  // simply left; the pending invite it belonged to is dropped by the promote below.
  const member: GroupMemberSecret = {
    cardId: accept.cardId,
    memberKey: accept.memberKey,
    lifecycleInbox: accept.leaveInbox,
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

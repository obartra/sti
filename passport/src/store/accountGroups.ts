/**
 * The shared-group account mutations (doc 33), split out of account.ts so it stays
 * within its length ceiling. Pure persistence over `modify` (the load-modify-save
 * closure createAccountManager builds); the server-side steps (mint the inbox, write
 * the accept, rewrite the group blob) live a layer up (groupMembershipOps). Every
 * mutation upserts/filters by id, so a lost-response retry replays to the same result.
 */

import type { RootKey } from "../crypto/index.ts";
import type { BlobModify } from "./account.ts";
import type {
  AccountBlob,
  GroupMemberSecret,
  GroupRecord,
  PendingGroupInvite,
} from "./accountBlob.ts";

/** The group-membership slice of the account manager (doc 33, slice 4a). */
export interface GroupMembershipAccounts {
  /**
   * Record a group the owner has JOINED as a member (doc 33, slice 4a): the same
   * atomic upsert-by-groupId as recordGroup, named for the member side (no write
   * token, no `Kg` yet).
   */
  recordJoinedGroup(root: RootKey, group: GroupRecord): Promise<AccountBlob>;
  /**
   * Append a pending invite to an admin group, upserting by inviteId so a retry does
   * not duplicate it. A no-op if the group is not present.
   */
  recordPendingInvite(
    root: RootKey,
    groupId: string,
    invite: PendingGroupInvite,
  ): Promise<AccountBlob>;
  /**
   * Drop a pending invite from an admin group: used by revoke (pre-accept) and by an
   * ingested reject. A no-op if unknown.
   */
  dropPendingInvite(
    root: RootKey,
    groupId: string,
    inviteId: string,
  ): Promise<AccountBlob>;
  /**
   * Promote a pending invite to a roster member: drop the pending invite and upsert
   * the member secret by cardId, in one atomic write. Idempotent, so a re-ingested
   * accept lands on the same result.
   */
  promoteInviteToMember(
    root: RootKey,
    groupId: string,
    inviteId: string,
    member: GroupMemberSecret,
  ): Promise<AccountBlob>;
  /** Drop a member from an admin group's roster once its blob has been rewritten. */
  dropGroupMember(
    root: RootKey,
    groupId: string,
    cardId: string,
  ): Promise<AccountBlob>;
  /**
   * Drop an entire group record from the account (doc 33, slice 4b): the member side
   * of leave. Filters by groupId, so a group already gone is a no-op (idempotent).
   * The server-side steps (write the leave marker, revoke the group card) run a layer
   * up (groupJoinOps); this just forgets the local record.
   */
  dropGroup(root: RootKey, groupId: string): Promise<AccountBlob>;
  /**
   * Cache the shared key `Kg` (base64url) on a member's group record once a roster
   * poll has trial-unwrapped it, so later polls skip the trial.
   */
  updateGroupKgCache(
    root: RootKey,
    groupId: string,
    kg: string,
  ): Promise<AccountBlob>;
}

// Append a shared group, upserting by groupId so a lost-response retry does not
// record the same group twice (which would orphan a group write token). Shared by
// recordGroup (create) and recordJoinedGroup (member join).
export function withGroupAppended(
  blob: AccountBlob,
  group: GroupRecord,
): AccountBlob {
  const others = (blob.groups ?? []).filter((g) => g.groupId !== group.groupId);
  return { ...blob, groups: [...others, group] };
}

// Update one group record in place, matched by groupId, leaving the rest untouched.
// A no-op (unchanged blob) when there are no groups or none match, so every mutation
// below fails safe rather than throwing on a stale id.
function withGroupUpdated(
  blob: AccountBlob,
  groupId: string,
  fn: (group: GroupRecord) => GroupRecord,
): AccountBlob {
  if (blob.groups === undefined) return blob;
  return {
    ...blob,
    groups: blob.groups.map((g) => (g.groupId === groupId ? fn(g) : g)),
  };
}

export function groupMembershipMethods(
  modify: BlobModify,
): GroupMembershipAccounts {
  return {
    recordJoinedGroup: (root, group) =>
      modify(root, (blob) => withGroupAppended(blob, group)),
    recordPendingInvite: (root, groupId, invite) =>
      modify(root, (blob) =>
        withGroupUpdated(blob, groupId, (g) => ({
          ...g,
          pendingInvites: [
            ...(g.pendingInvites ?? []).filter(
              (p) => p.inviteId !== invite.inviteId,
            ),
            invite,
          ],
        })),
      ),
    dropPendingInvite: (root, groupId, inviteId) =>
      modify(root, (blob) =>
        withGroupUpdated(blob, groupId, (g) => ({
          ...g,
          pendingInvites: (g.pendingInvites ?? []).filter(
            (p) => p.inviteId !== inviteId,
          ),
        })),
      ),
    promoteInviteToMember: (root, groupId, inviteId, member) =>
      modify(root, (blob) =>
        withGroupUpdated(blob, groupId, (g) => ({
          ...g,
          pendingInvites: (g.pendingInvites ?? []).filter(
            (p) => p.inviteId !== inviteId,
          ),
          members: [
            ...(g.members ?? []).filter((m) => m.cardId !== member.cardId),
            member,
          ],
        })),
      ),
    dropGroupMember: (root, groupId, cardId) =>
      modify(root, (blob) =>
        withGroupUpdated(blob, groupId, (g) => ({
          ...g,
          members: (g.members ?? []).filter((m) => m.cardId !== cardId),
        })),
      ),
    dropGroup: (root, groupId) =>
      modify(root, (blob) => ({
        ...blob,
        groups: (blob.groups ?? []).filter((g) => g.groupId !== groupId),
      })),
    updateGroupKgCache: (root, groupId, kg) =>
      modify(root, (blob) =>
        withGroupUpdated(blob, groupId, (g) => ({ ...g, kg })),
      ),
  };
}

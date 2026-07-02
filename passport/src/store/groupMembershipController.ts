/**
 * The shared-group membership slice of the session controller (doc 33, slice 4a):
 * the interface SessionController extends, plus the thin wrappers that translate the
 * controller's (session, ids) shape into the membership ops' bundled-argument form.
 * Split from session.ts and groupMembershipOps.ts so each stays within its length
 * ceiling; this file is only the wiring, the behavior is in groupMembershipOps.
 */

import type { ApiClient } from "../api/client.ts";
import type { AccountManager } from "./account.ts";
import type { OwnerSession } from "./session.ts";
import type { GroupInvite } from "./groupInvite.ts";
import {
  inviteToGroup,
  revokeGroupInvite,
  acceptGroupInvite,
  rejectGroupInvite,
  pollGroupLifecycle,
  removeGroupMember,
  readGroupRoster,
  type GroupInviteResult,
  type GroupRosterView,
} from "./groupMembershipOps.ts";

export interface GroupMembershipController {
  /**
   * Invite someone into a group the owner admins: mint the admin<->member lifecycle
   * inbox, record the pending invite, and return the invite link (all capabilities
   * in its fragment, nothing to the server) plus the updated session. `label` is an
   * optional private note. The invitee accepts via acceptGroupInvite; the admin
   * ingests it via pollGroupLifecycle.
   */
  inviteToGroup(
    session: OwnerSession,
    groupId: string,
    opts?: { label?: string },
  ): Promise<GroupInviteResult>;
  /**
   * Revoke a not-yet-accepted invite: overwrite its lifecycle inbox (killing any
   * accept already written) and drop the pending invite. A no-op when unknown.
   */
  revokeGroupInvite(
    session: OwnerSession,
    groupId: string,
    inviteId: string,
  ): Promise<OwnerSession>;
  /**
   * Accept a group invite: derive our member key, write the accept to the lifecycle
   * inbox, and record the member-side group locally. We publish our card only on the
   * next roster poll, once the admin has added our slot and we hold `Kg`.
   */
  acceptGroupInvite(
    session: OwnerSession,
    invite: GroupInvite,
  ): Promise<OwnerSession>;
  /** Reject a group invite: tell the admin to drop it; the session is unchanged. */
  rejectGroupInvite(
    session: OwnerSession,
    invite: GroupInvite,
  ): Promise<OwnerSession>;
  /**
   * Ingest pending accepts/rejects across all groups the owner admins: for each,
   * poll the lifecycle inbox and, on an accept, add the member's slot and grow the
   * roster; on a reject, drop the invite. Idempotent and fail-closed (an empty/decoy
   * inbox leaves the invite pending).
   */
  pollGroupLifecycle(session: OwnerSession): Promise<OwnerSession>;
  /**
   * Remove a member from a group the owner admins: drop their slot + roster entry
   * from the blob and the local roster secret. No key rotation yet (slice 5), so the
   * removed member keeps the `Kg` they hold; the roster change is what others see,
   * indistinguishable from a leave. A no-op when unknown.
   */
  removeGroupMember(
    session: OwnerSession,
    groupId: string,
    cardId: string,
  ): Promise<OwnerSession>;
  /**
   * Read a group's roster: open the blob (as admin/holder or, as a member, by
   * trial-unwrap) and open every member's card under `Kg`. A member's first
   * successful read caches `Kg` and publishes their own card, so the returned session
   * carries that update. `obj` is null (roster empty) when the group is not yet
   * readable by this reader.
   */
  readGroupRoster(
    session: OwnerSession,
    groupId: string,
  ): Promise<GroupRosterView>;
}

/** Build the group-membership controller methods (doc 33, slice 4a). */
export function groupMembershipControllerMethods(
  api: ApiClient,
  accounts: AccountManager,
): GroupMembershipController {
  return {
    inviteToGroup: (session, groupId, opts) =>
      inviteToGroup(accounts, session, {
        groupId,
        ...(opts?.label !== undefined ? { label: opts.label } : {}),
      }),
    revokeGroupInvite: (session, groupId, inviteId) =>
      revokeGroupInvite(api, accounts, session, { groupId, inviteId }),
    acceptGroupInvite: (session, invite) =>
      acceptGroupInvite(api, accounts, session, invite),
    rejectGroupInvite: (session, invite) =>
      rejectGroupInvite(api, session, invite),
    pollGroupLifecycle: (session) => pollGroupLifecycle(api, accounts, session),
    removeGroupMember: (session, groupId, cardId) =>
      removeGroupMember(api, accounts, session, { groupId, cardId }),
    readGroupRoster: (session, groupId) =>
      readGroupRoster(api, accounts, session, groupId),
  };
}

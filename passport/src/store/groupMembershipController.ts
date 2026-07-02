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
  removeGroupMember,
  readGroupRoster,
  type GroupInviteResult,
  type GroupRosterView,
} from "./groupMembershipOps.ts";
import { pollGroupLifecycle } from "./groupIngestOps.ts";
import {
  requestToJoin,
  reviewJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
  redeemJoinRequests,
  leaveGroup,
  type JoinRequesterDeps,
  type RequestResult,
  type PendingRequest,
} from "./groupJoinOps.ts";
import { browserRequesterSecret } from "./requesterStore.ts";
import { browserGrantKeyStore } from "./grantKeyStore.ts";
import { browserGroupJoinStore } from "./groupJoinStore.ts";

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
   * Remove a member from a group the owner admins (doc 33, slice 5): mint a fresh
   * `Kg'`, re-wrap it to the surviving members, re-seal the core, and republish the
   * admin's own card under it. The removed member keeps the old `Kg` they hold, but it
   * now opens nothing new (no future reads). The roster change is what others see,
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
  /**
   * Request to join a public group by handle (doc 33, slice 4b): knock at its join
   * pointer and record the request locally so a return visit can redeem an approval.
   * `not-found` when the handle does not resolve to a public group (uniform, no
   * leak). Session is unused (the request is device-local) but taken for symmetry.
   */
  requestToJoin(session: OwnerSession, handle: string): Promise<RequestResult>;
  /**
   * The waiting join requests for a public group the owner admins: the grantable
   * ones, with any the admin dismissed hidden. Binds the join-pointer capability
   * first (the slice-3 touch-up/backfill). Empty for a non-admin/non-public group.
   */
  reviewJoinRequests(
    session: OwnerSession,
    groupId: string,
  ): Promise<PendingRequest[]>;
  /**
   * Approve a join request by delivering an invite over the grant channel (mint the
   * lifecycle inbox, record the pending invite, seal the invite to the requester);
   * the accept is then ingested via pollGroupLifecycle. A no-op when the group is
   * full or not an admin/public group.
   */
  approveJoinRequest(
    session: OwnerSession,
    groupId: string,
    request: PendingRequest,
  ): Promise<OwnerSession>;
  /**
   * Reject a join request: hide it from future reviews. No server write (a rejection
   * signal would be a new oracle); the requester's knock self-expires. Unchanged
   * session.
   */
  rejectJoinRequest(
    session: OwnerSession,
    groupId: string,
    request: PendingRequest,
  ): Promise<OwnerSession>;
  /**
   * Redeem any approved join requests this device made: poll each pending join's
   * grant slot and, on a sealed invite, run the same accept an invited member runs.
   * Idempotent and fail-closed. Returns the session with any newly joined groups.
   */
  redeemJoinRequests(session: OwnerSession): Promise<OwnerSession>;
  /**
   * Leave a group (member self): write the leave marker to the admin<->member
   * channel, gray out our own group card, and drop the local record. The admin drops
   * us from the roster on their next poll, indistinguishable from a remove. A no-op
   * when the group is unknown or the owner is its admin.
   */
  leaveGroup(session: OwnerSession, groupId: string): Promise<OwnerSession>;
}

/**
 * Build the group-membership controller methods (doc 33, slices 4a + 4b): the invite
 * side, plus the request side and leave. The request path's device-local
 * capabilities default to the browser-backed stores (volatile in-memory when
 * localStorage is unavailable), the same ones the backend store's viewer knock path
 * uses, so they read the same persisted requester secret + grant keys; a test can
 * inject an in-memory `joinDeps` instead.
 */
export function groupMembershipControllerMethods(
  api: ApiClient,
  accounts: AccountManager,
  joinDeps: JoinRequesterDeps = {
    requesterSecret: browserRequesterSecret(),
    grantKeys: browserGrantKeyStore(),
    joinStore: browserGroupJoinStore(),
  },
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
    requestToJoin: (_session, handle) => requestToJoin(api, joinDeps, handle),
    reviewJoinRequests: (session, groupId) =>
      reviewJoinRequests(api, joinDeps.joinStore, session, groupId),
    approveJoinRequest: (session, groupId, request) =>
      approveJoinRequest(api, accounts, session, { groupId, request }),
    rejectJoinRequest: (session, groupId, request) =>
      Promise.resolve(
        rejectJoinRequest(joinDeps.joinStore, session, {
          groupId,
          requesterHash: request.requesterHash,
        }),
      ),
    redeemJoinRequests: (session) =>
      redeemJoinRequests(api, accounts, joinDeps, session),
    leaveGroup: (session, groupId) =>
      leaveGroup(api, accounts, session, groupId),
  };
}

import { useCallback, type RefObject } from "react";
import type {
  GroupInvite,
  OwnerSession,
  PendingRequest,
  RequestResult,
  SessionController,
} from "../../store/index.ts";

/**
 * The shared-group cross-party actions (doc 33, slice 7b): the admin invite / request
 * / remove side, and the joiner accept / request side. Split from useOwnerActions so
 * that file stays within its length ceiling. Same read-ref, run-controller,
 * fold-result-into-session shape as the rest; each is a no-op while logged out.
 *
 * Some resolve a value the caller needs: onInviteToGroup returns the invite URL,
 * onReviewJoinRequests the waiting requests, onRequestToJoin how the ask landed. The
 * approve/reject/remove/accept paths fold the session and resolve void so the UI can
 * await them and refresh (the roster re-reads after a remove; the review re-reads).
 */
export interface GroupJoinActions {
  onInviteToGroup: (groupId: string, label?: string) => Promise<string>;
  onRevokeGroupInvite: (groupId: string, inviteId: string) => void;
  onReviewJoinRequests: (groupId: string) => Promise<PendingRequest[]>;
  onApproveJoinRequest: (
    groupId: string,
    request: PendingRequest,
  ) => Promise<void>;
  onRejectJoinRequest: (
    groupId: string,
    request: PendingRequest,
  ) => Promise<void>;
  onRemoveGroupMember: (groupId: string, cardId: string) => Promise<void>;
  onAcceptGroupInvite: (invite: GroupInvite) => Promise<void>;
  onRejectGroupInvite: (invite: GroupInvite) => Promise<void>;
  onRequestToJoin: (handle: string) => Promise<RequestResult>;
}

interface Deps {
  controller: SessionController;
  sessionRef: RefObject<OwnerSession | null>;
  setSession: (s: OwnerSession | null) => void;
}

// The admin side (invite / revoke / review / approve / reject / remove).
function useGroupAdminActions({
  controller,
  sessionRef,
  setSession,
}: Deps): Pick<
  GroupJoinActions,
  | "onInviteToGroup"
  | "onRevokeGroupInvite"
  | "onReviewJoinRequests"
  | "onApproveJoinRequest"
  | "onRejectJoinRequest"
  | "onRemoveGroupMember"
> {
  const onInviteToGroup = useCallback(
    async (groupId: string, label?: string) => {
      const current = sessionRef.current;
      if (current === null) throw new Error("not signed in");
      const { session, url } = await controller.inviteToGroup(
        current,
        groupId,
        label !== undefined ? { label } : undefined,
      );
      sessionRef.current = session;
      setSession(session);
      return url;
    },
    [controller, sessionRef, setSession],
  );

  const onRevokeGroupInvite = useCallback(
    (groupId: string, inviteId: string) => {
      const current = sessionRef.current;
      if (current === null) return;
      void controller
        .revokeGroupInvite(current, groupId, inviteId)
        .then((updated) => {
          sessionRef.current = updated;
          setSession(updated);
        })
        .catch(() => undefined);
    },
    [controller, sessionRef, setSession],
  );

  const onReviewJoinRequests = useCallback(
    (groupId: string) => {
      const current = sessionRef.current;
      if (current === null) return Promise.resolve<PendingRequest[]>([]);
      return controller.reviewJoinRequests(current, groupId);
    },
    [controller, sessionRef],
  );

  const onApproveJoinRequest = useCallback(
    async (groupId: string, request: PendingRequest) => {
      const current = sessionRef.current;
      if (current === null) return;
      const updated = await controller.approveJoinRequest(
        current,
        groupId,
        request,
      );
      sessionRef.current = updated;
      setSession(updated);
    },
    [controller, sessionRef, setSession],
  );

  const onRejectJoinRequest = useCallback(
    async (groupId: string, request: PendingRequest) => {
      const current = sessionRef.current;
      if (current === null) return;
      const updated = await controller.rejectJoinRequest(
        current,
        groupId,
        request,
      );
      sessionRef.current = updated;
      setSession(updated);
    },
    [controller, sessionRef, setSession],
  );

  const onRemoveGroupMember = useCallback(
    async (groupId: string, cardId: string) => {
      const current = sessionRef.current;
      if (current === null) return;
      const updated = await controller.removeGroupMember(
        current,
        groupId,
        cardId,
      );
      sessionRef.current = updated;
      setSession(updated);
    },
    [controller, sessionRef, setSession],
  );

  return {
    onInviteToGroup,
    onRevokeGroupInvite,
    onReviewJoinRequests,
    onApproveJoinRequest,
    onRejectJoinRequest,
    onRemoveGroupMember,
  };
}

// The joiner side (accept / reject an invite, request to join by name).
function useGroupJoinerActions({
  controller,
  sessionRef,
  setSession,
}: Deps): Pick<
  GroupJoinActions,
  "onAcceptGroupInvite" | "onRejectGroupInvite" | "onRequestToJoin"
> {
  const onAcceptGroupInvite = useCallback(
    async (invite: GroupInvite) => {
      const current = sessionRef.current;
      if (current === null) return;
      const updated = await controller.acceptGroupInvite(current, invite);
      sessionRef.current = updated;
      setSession(updated);
    },
    [controller, sessionRef, setSession],
  );

  const onRejectGroupInvite = useCallback(
    async (invite: GroupInvite) => {
      const current = sessionRef.current;
      if (current === null) return;
      const updated = await controller.rejectGroupInvite(current, invite);
      sessionRef.current = updated;
      setSession(updated);
    },
    [controller, sessionRef, setSession],
  );

  const onRequestToJoin = useCallback(
    (handle: string) => {
      const current = sessionRef.current;
      if (current === null) return Promise.resolve<RequestResult>("not-found");
      return controller.requestToJoin(current, handle);
    },
    [controller, sessionRef],
  );

  return { onAcceptGroupInvite, onRejectGroupInvite, onRequestToJoin };
}

export function useGroupJoinActions(
  controller: SessionController,
  sessionRef: RefObject<OwnerSession | null>,
  setSession: (s: OwnerSession | null) => void,
): GroupJoinActions {
  const deps: Deps = { controller, sessionRef, setSession };
  return {
    ...useGroupAdminActions(deps),
    ...useGroupJoinerActions(deps),
  };
}

import { useCallback, type RefObject } from "react";
import type {
  ContactInvite,
  ContactLinkResult,
  OwnerSession,
  SessionController,
} from "../../store/index.ts";
import { disablePush } from "../../store/push.ts";

export interface OwnerActions {
  /** Permanently delete the account and log out (clamps to the landing). */
  onDeleteAccount: () => void;
  /** Mint a new per-contact link with a chosen lifetime (days, or null for
   * until-revoked); resolves with the contact + URL. */
  onCreateContactLink: (
    label: string,
    durationMs: number | null,
  ) => Promise<ContactLinkResult>;
  /** Revoke one contact link by id. */
  onRevokeContact: (id: string) => void;
  /** Change one contact link's lifetime in place (days from today, or null for
   * until-revoked); the same link keeps working. */
  onSetContactDuration: (id: string, durationMs: number | null) => void;
  /** Revoke one published alias (public/casual link) by id. */
  onRevokeAlias: (id: string) => void;
  /** Accept a contact invite; resolves with the return invite to send back. */
  onAcceptContactInvite: (
    invite: ContactInvite,
    label: string,
  ) => Promise<ContactLinkResult>;
  /** Ingest a return invite, completing the matching pending contact (no-op if none). */
  onIngestContactReturn: (ret: ContactInvite) => void;
  /** Create a circle from a name + chosen contact ids; resolves the new circle id. */
  onCreateCircle: (name: string, memberContactIds: string[]) => Promise<string>;
  /** Rename a circle and/or change its members (same id). */
  onUpdateCircle: (
    id: string,
    name: string,
    memberContactIds: string[],
  ) => void;
  /** Delete one circle by id (a local grouping; contacts untouched). */
  onRemoveCircle: (id: string) => void;
}

/**
 * Owner-state mutations that delete or reshape the account: account deletion and
 * per-contact link create/revoke. Each reads the latest session from the ref and
 * folds the controller's result back into the session (optimistic where it can
 * be), so App stays a thin host. A no-op while logged out.
 *
 * NOTE: these read sessionRef.current before an await and write the result back,
 * so a concurrent edit landing during the await is last-write-wins in memory
 * (single-device, modal UI makes this rare, and the next account sync reconciles).
 */
export function useOwnerActions(
  controller: SessionController,
  sessionRef: RefObject<OwnerSession | null>,
  setSession: (s: OwnerSession | null) => void,
): OwnerActions {
  const onDeleteAccount = useCallback(() => {
    const current = sessionRef.current;
    if (current === null) return;
    sessionRef.current = null;
    setSession(null);
    void controller.deleteAccount(current).catch(() => undefined);
    // Also forget this device's push context so the deleted account's notify
    // capability does not linger at rest in IndexedDB (best-effort, never throws).
    void disablePush();
  }, [controller, sessionRef, setSession]);

  const onCreateContactLink = useCallback(
    async (label: string, durationMs: number | null) => {
      const current = sessionRef.current;
      if (current === null) throw new Error("not signed in");
      const result = await controller.createContactLink(
        current,
        label,
        "anonymous",
        durationMs,
      );
      sessionRef.current = result.session;
      setSession(result.session);
      return result;
    },
    [controller, sessionRef, setSession],
  );

  const onRevokeContact = useCallback(
    (id: string) => {
      const current = sessionRef.current;
      if (current === null) return;
      void controller
        .revokeContact(current, id)
        .then((updated) => {
          sessionRef.current = updated;
          setSession(updated);
        })
        .catch(() => undefined);
    },
    [controller, sessionRef, setSession],
  );

  const onSetContactDuration = useCallback(
    (id: string, durationMs: number | null) => {
      const current = sessionRef.current;
      if (current === null) return;
      void controller
        .setContactDuration(current, id, durationMs)
        .then((updated) => {
          sessionRef.current = updated;
          setSession(updated);
        })
        .catch(() => undefined);
    },
    [controller, sessionRef, setSession],
  );

  const onRevokeAlias = useCallback(
    (id: string) => {
      const current = sessionRef.current;
      if (current === null) return;
      void controller
        .revokeAlias(current, id)
        .then((updated) => {
          sessionRef.current = updated;
          setSession(updated);
        })
        .catch(() => undefined);
    },
    [controller, sessionRef, setSession],
  );

  const onAcceptContactInvite = useCallback(
    async (invite: ContactInvite, label: string) => {
      const current = sessionRef.current;
      if (current === null) throw new Error("not signed in");
      const result = await controller.acceptContactInvite(
        current,
        invite,
        label,
      );
      sessionRef.current = result.session;
      setSession(result.session);
      return result;
    },
    [controller, sessionRef, setSession],
  );

  const onIngestContactReturn = useCallback(
    (ret: ContactInvite) => {
      const current = sessionRef.current;
      if (current === null) return;
      void controller
        .ingestContactReturn(current, ret)
        .then((updated) => {
          sessionRef.current = updated;
          setSession(updated);
        })
        .catch(() => undefined);
    },
    [controller, sessionRef, setSession],
  );

  const circle = useCircleActions(controller, sessionRef, setSession);

  return {
    onDeleteAccount,
    onCreateContactLink,
    onRevokeContact,
    onSetContactDuration,
    onRevokeAlias,
    onAcceptContactInvite,
    onIngestContactReturn,
    ...circle,
  };
}

// The circle mutations (create / rename+remember-members / delete), split out so
// useOwnerActions stays within its length ceiling. Same fold-result-into-session
// shape as the rest.
function useCircleActions(
  controller: SessionController,
  sessionRef: RefObject<OwnerSession | null>,
  setSession: (s: OwnerSession | null) => void,
): Pick<OwnerActions, "onCreateCircle" | "onUpdateCircle" | "onRemoveCircle"> {
  const onCreateCircle = useCallback(
    async (name: string, memberContactIds: string[]) => {
      const current = sessionRef.current;
      if (current === null) throw new Error("not signed in");
      const { session, circleId } = await controller.createCircle(
        current,
        name,
        memberContactIds,
      );
      sessionRef.current = session;
      setSession(session);
      return circleId;
    },
    [controller, sessionRef, setSession],
  );

  const onUpdateCircle = useCallback(
    (id: string, name: string, memberContactIds: string[]) => {
      const current = sessionRef.current;
      if (current === null) return;
      void controller
        .updateCircle(current, id, name, memberContactIds)
        .then((updated) => {
          sessionRef.current = updated;
          setSession(updated);
        })
        .catch(() => undefined);
    },
    [controller, sessionRef, setSession],
  );

  const onRemoveCircle = useCallback(
    (id: string) => {
      const current = sessionRef.current;
      if (current === null) return;
      void controller
        .removeCircle(current, id)
        .then((updated) => {
          sessionRef.current = updated;
          setSession(updated);
        })
        .catch(() => undefined);
    },
    [controller, sessionRef, setSession],
  );

  return { onCreateCircle, onUpdateCircle, onRemoveCircle };
}

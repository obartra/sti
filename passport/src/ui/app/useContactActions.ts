import { useCallback, type RefObject } from "react";
import type {
  ContactInvite,
  OwnerSession,
  SessionController,
} from "../../store/index.ts";
import { todayEpochDay } from "../../core/clock.ts";
import type { OwnerActions } from "./useOwnerActions.ts";

/**
 * The per-contact link mutations (rename, back-date, revoke, walk-away discard,
 * and the in-person completion), split into their own file so useOwnerActions
 * stays within its length ceiling and this set has room to grow with the connect
 * feature. Each reads the latest session, runs the controller op, and folds the
 * result back; a no-op while logged out, and a fire-and-fold failure leaves the
 * session as-is.
 */
export function useContactActions(
  controller: SessionController,
  sessionRef: RefObject<OwnerSession | null>,
  setSession: (s: OwnerSession | null) => void,
): Pick<
  OwnerActions,
  | "onRenameContact"
  | "onSetEncounterDay"
  | "onRevokeContact"
  | "onDiscardOffer"
  | "onCompleteLinkup"
> {
  // Run a controller op that folds a new session back, reading the latest session
  // each call. Shared by the fire-and-fold id-keyed mutations below.
  const fold = useCallback(
    (run: (s: OwnerSession) => Promise<OwnerSession>) => {
      const current = sessionRef.current;
      if (current === null) return;
      void run(current)
        .then((updated) => {
          sessionRef.current = updated;
          setSession(updated);
        })
        .catch(() => undefined);
    },
    [sessionRef, setSession],
  );

  const onRenameContact = useCallback(
    (id: string, label: string) =>
      fold((s) => controller.renameContact(s, id, label)),
    [fold, controller],
  );

  const onSetEncounterDay = useCallback(
    (id: string, day: number) =>
      fold((s) =>
        controller.setContactEncounterDay(s, id, day, todayEpochDay()),
      ),
    [fold, controller],
  );

  const onRevokeContact = useCallback(
    (id: string) => fold((s) => controller.revokeContact(s, id)),
    [fold, controller],
  );

  const onDiscardOffer = useCallback(
    (id: string) => fold((s) => controller.discardOffer(s, id)),
    [fold, controller],
  );

  const onCompleteLinkup = useCallback(
    async (contactId: string, invite: ContactInvite) => {
      const current = sessionRef.current;
      if (current === null) throw new Error("not signed in");
      const updated = await controller.completeInPersonLinkup(
        current,
        contactId,
        invite,
      );
      sessionRef.current = updated;
      setSession(updated);
    },
    [controller, sessionRef, setSession],
  );

  return {
    onRenameContact,
    onSetEncounterDay,
    onRevokeContact,
    onDiscardOffer,
    onCompleteLinkup,
  };
}

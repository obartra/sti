import { useCallback, type RefObject } from "react";
import type { OwnerSession, SessionController } from "../../store/index.ts";
import type { OwnerState } from "../../core/badge.ts";
import { applyReport, type ReportOutcome } from "../../core/report.ts";
import { todayEpochDay } from "../../core/clock.ts";

/**
 * The owner's badge-state mutations, kept together because the report path is built
 * on the generic state update. `setOwnerState` applies an updater optimistically
 * (so a follow-up edit sees it immediately) then persists + republishes in the
 * background; `onReport` stamps a reported result with the report day and, for an
 * active non-HIV positive, silently notifies linked contacts (doc 13). Both read
 * the latest session from the ref, so a write in flight never clobbers a later edit.
 */
export function useOwnerStateActions(
  controller: SessionController,
  sessionRef: RefObject<OwnerSession | null>,
  setSession: (s: OwnerSession | null) => void,
): {
  setOwnerState: (update: (prev: OwnerState) => OwnerState) => void;
  onReport: (outcome: ReportOutcome) => void;
} {
  const setOwnerState = useCallback(
    (update: (prev: OwnerState) => OwnerState) => {
      const current = sessionRef.current;
      if (current === null) return;
      const next = update(current.blob.state);
      const optimistic: OwnerSession = {
        ...current,
        blob: { ...current.blob, state: next },
      };
      sessionRef.current = optimistic;
      setSession(optimistic);
      void controller
        .setOwnerState(current, next)
        .then((saved) => {
          sessionRef.current = saved;
          setSession(saved);
        })
        .catch(() => undefined);
    },
    [controller, sessionRef, setSession],
  );

  const onReport = useCallback(
    (outcome: ReportOutcome) => {
      setOwnerState((s) => applyReport(s, outcome, todayEpochDay()));
      // A reported active non-HIV positive silently notifies linked contacts (doc 13).
      if (outcome.activeNonHivSti) {
        const current = sessionRef.current;
        if (current !== null) {
          void controller
            .notifyContactsOfPositive(current)
            .catch(() => undefined);
        }
      }
    },
    [setOwnerState, controller, sessionRef],
  );

  return { setOwnerState, onReport };
}

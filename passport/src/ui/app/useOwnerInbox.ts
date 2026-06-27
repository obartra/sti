import { useCallback } from "react";
import type { OwnerSession, SessionController } from "../../store/index.ts";
import { useKnockReview } from "./useKnockReview.ts";
import { usePartnerNudge } from "./usePartnerNudge.ts";
import { useCatchup } from "./useCatchup.ts";

/**
 * The owner's quiet inbox: the two owner-pull channels behind the bell, combined.
 * Knock review (someone asked to see your status) and the partner-notify nudge (a
 * linked contact reported a positive). Both are contentless and best-effort, and
 * both re-pull on `refreshInbox` (called when the inbox opens), so the screen has
 * one refresh, not two. A null session is empty across the board.
 *
 * It also re-pulls on reconnect (doc 22, "Slice 5 reconsidered"): a user with
 * intermittent internet catches up on a waiting partner-notify the moment they are
 * back online, without a periodic background poll. This reuses the foreground
 * owner-pull, so it adds no cadence the server could fingerprint.
 */
export function useOwnerInbox(
  controller: SessionController,
  session: OwnerSession | null,
): {
  knockCount: number;
  canApproveKnocks: boolean;
  showKnockInfo: boolean;
  approveKnocks: () => void;
  approvingKnocks: boolean;
  showPartnerNudge: boolean;
  dismissPartnerNudge: () => void;
  refreshInbox: () => void;
} {
  const knocks = useKnockReview(controller, session);
  const partner = usePartnerNudge(controller, session);

  // Depend on the two stable refresh callbacks, NOT the hook return objects. Those
  // objects are fresh literals every render, so depending on them made refreshInbox
  // change identity every render, which churned useCatchup's effect and cancelled a
  // pending jittered reconnect catch-up (rescheduled only on the next `online`
  // event) before it could fire. The refresh callbacks are stable across ordinary
  // re-renders (they re-key only on session change), so refreshInbox now is too.
  const { refresh: refreshKnocks } = knocks;
  const { refresh: refreshPartner } = partner;
  const refreshInbox = useCallback(() => {
    refreshKnocks();
    refreshPartner();
  }, [refreshKnocks, refreshPartner]);

  useCatchup(session !== null, refreshInbox);

  return {
    knockCount: knocks.knockCount,
    canApproveKnocks: knocks.canApprove,
    showKnockInfo: knocks.showInfo,
    approveKnocks: knocks.approve,
    approvingKnocks: knocks.approving,
    showPartnerNudge: partner.showNudge,
    dismissPartnerNudge: partner.dismiss,
    refreshInbox,
  };
}

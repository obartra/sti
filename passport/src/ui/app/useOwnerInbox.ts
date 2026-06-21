import { useCallback } from "react";
import type { OwnerSession, SessionController } from "../../store/index.ts";
import { useKnockReview } from "./useKnockReview.ts";
import { usePartnerNudge } from "./usePartnerNudge.ts";

/**
 * The owner's quiet inbox: the two owner-pull channels behind the bell, combined.
 * Knock review (someone asked to see your status) and the partner-notify nudge (a
 * linked contact reported a positive). Both are contentless and best-effort, and
 * both re-pull on `refreshInbox` (called when the inbox opens), so the screen has
 * one refresh, not two. A null session is empty across the board.
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

  const refreshInbox = useCallback(() => {
    knocks.refresh();
    partner.refresh();
  }, [knocks, partner]);

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

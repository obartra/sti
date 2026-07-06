import { useEffect, useRef, type RefObject } from "react";
import type { OwnerSession, SessionController } from "../../store/index.ts";
import { todayEpochDay } from "../../core/clock.ts";

/**
 * Republish-on-open (doc 02). The published card is a snapshot whose badge ages with
 * the wall clock, so a passive owner's blue can lapse (or a cleared clearance window
 * can re-blue) without their links being re-sealed. This re-seals every live link at
 * today's day on open and again whenever the tab regains focus, so the stored card
 * tracks the owner's real status. The read-time freshness gate (applyFreshness) is
 * the hard backstop for stale-blue; this keeps the snapshot itself current, which the
 * gate cannot do for the gray-to-blue direction (that would leak the reason).
 *
 * Throttled to once per calendar day: re-sealing is a network write per link, and the
 * badge can only change on a day rollover, so a per-day guard avoids needless churn
 * (and needless decorrelation-window republishes) while covering a tab left open
 * across midnight.
 */
export function useCardRefresh(
  controller: SessionController,
  sessionRef: RefObject<OwnerSession | null>,
  loggedIn: boolean,
): void {
  // The last epoch day a refresh ran, so focus/visibility re-fires collapse to at
  // most one republish per day.
  const lastDay = useRef<number | null>(null);

  useEffect(() => {
    if (!loggedIn) return;
    const refresh = (): void => {
      const current = sessionRef.current;
      if (current === null) return;
      const today = todayEpochDay();
      if (lastDay.current === today) return;
      lastDay.current = today;
      // Best-effort: a network blip just leaves the snapshot until the next open; the
      // read-time gate still protects viewers from stale-blue in the meantime.
      void controller.refreshLiveLinks(current).catch(() => {
        // Failed: allow a retry on the next focus by clearing the day guard.
        lastDay.current = null;
      });
    };
    const onVisible = (): void => {
      if (document.visibilityState === "visible") refresh();
    };
    refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refresh);
    };
  }, [controller, sessionRef, loggedIn]);
}

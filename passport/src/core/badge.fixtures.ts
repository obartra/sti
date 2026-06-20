import type { OwnerState } from "./badge.ts";

/**
 * A fixed reference "today" for badge tests. Time is injected (computeBadge takes
 * nowDay), so tests pin it to this constant and express panel dates relative to
 * it via {@link daysAgo}, keeping scenarios readable and deterministic.
 */
export const NOW_DAY = 20_000;

/** An epoch day `n` days before {@link NOW_DAY}. */
export function daysAgo(n: number): number {
  return NOW_DAY - n;
}

/** A canonical owner eligible for blue (tested in window, clear, on PrEP, not paused). */
export function blueEligible(): OwnerState {
  return {
    testing: {
      lastPanelDay: daysAgo(10),
      corePanelComplete: true,
      exposedSitesCovered: true,
    },
    hiv: "negative",
    activeNonHivSti: false,
    onPrep: true,
    condomPreference: "none",
    condomPreferencePublic: false,
    onDoxyPep: false,
    paused: false,
  };
}

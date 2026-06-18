import type { OwnerState } from "./badge.ts";

/** A canonical owner eligible for blue (tested in window, clear, on PrEP, not paused). */
export function blueEligible(): OwnerState {
  return {
    testing: {
      hasEverTested: true,
      lastPanelAgeDays: 10,
      corePanelComplete: true,
      exposedSitesCovered: true,
    },
    hiv: "negative",
    activeNonHivSti: false,
    onPrep: true,
    condomPreference: "none",
    condomPreferencePublic: false,
    paused: false,
  };
}

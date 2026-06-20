/**
 * Apply a reported test outcome to the owner's state. This is the trust-critical
 * bridge from "the owner entered results" to the badge inputs: it updates ONLY
 * what a test result establishes (recency, core-panel coverage, HIV status, a
 * current active non-HIV STI) and preserves everything a test does not speak to
 * (PrEP, condom preference, a manual pause). The badge is then recomputed from
 * the result by {@link computeBadge}; this never sets a badge directly.
 *
 * Note a result alone does not necessarily earn blue: blue still requires a
 * qualifying HIV-protection route (PrEP, undetectable HIV, or public
 * condoms-always). A negative panel with no route stays gray, by design.
 */

import type { HivStatus, OwnerState } from "./badge.ts";

/** The badge-relevant outcome of a reported test, derived from the report UI. */
export interface ReportOutcome {
  /**
   * The HIV status this report establishes, or undefined when HIV was not
   * tested (so a prior status, e.g. undetectable/U=U, is preserved rather than
   * silently reset to negative).
   */
  readonly hiv?: HivStatus | undefined;
  /** The standard core panel (HIV, syphilis, gonorrhea, chlamydia) was complete. */
  readonly corePanelComplete: boolean;
  /** A current active non-HIV STI (a core positive other than HIV). */
  readonly activeNonHivSti: boolean;
}

/**
 * Merge a fresh report into the owner's state: marks tested-now (age 0) and sets
 * the result-derived fields. Core-panel completeness also gates exposed-site
 * coverage here, since the report treats them together (a site left untested
 * leaves the panel incomplete). An untested HIV preserves the prior status.
 * PrEP, condom preference, and pause are untouched.
 */
export function applyReport(prev: OwnerState, o: ReportOutcome): OwnerState {
  return {
    ...prev,
    testing: {
      hasEverTested: true,
      lastPanelAgeDays: 0,
      corePanelComplete: o.corePanelComplete,
      exposedSitesCovered: o.corePanelComplete,
    },
    hiv: o.hiv ?? prev.hiv,
    activeNonHivSti: o.activeNonHivSti,
  };
}

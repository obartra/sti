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

import {
  CLEARANCE_WINDOW_DAYS,
  type HivStatus,
  type OwnerState,
} from "./badge.ts";

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
 * Merge a fresh report into the owner's state: stamps the panel with the report
 * day (`nowDay`, from core/clock) so freshness ages from it, and sets the
 * result-derived fields. Core-panel completeness also gates exposed-site
 * coverage here, since the report treats them together (a site left untested
 * leaves the panel incomplete). An untested HIV preserves the prior status.
 * PrEP, condom preference, and manual pause are untouched.
 *
 * A reported non-HIV positive also arms the clearance-window auto-pause from the
 * report day (treatment day defaults to now), so the badge stays gray through the
 * post-treatment window even after a later "cleared" report. The window only ever
 * extends (max), never shortens, so it cannot be lifted before the guideline
 * window. A clear report leaves any active window in place.
 */
export function applyReport(
  prev: OwnerState,
  o: ReportOutcome,
  nowDay: number,
): OwnerState {
  const clearUntilDay = o.activeNonHivSti
    ? Math.max(prev.clearUntilDay ?? 0, nowDay + CLEARANCE_WINDOW_DAYS)
    : prev.clearUntilDay;
  return {
    ...prev,
    testing: {
      lastPanelDay: nowDay,
      corePanelComplete: o.corePanelComplete,
      exposedSitesCovered: o.corePanelComplete,
    },
    hiv: o.hiv ?? prev.hiv,
    activeNonHivSti: o.activeNonHivSti,
    clearUntilDay,
  };
}

/**
 * Extend the clearance-window auto-pause by one window (the "keep paused longer"
 * affordance). Extends from the current end, or from now if none is active; the
 * owner can hold the badge gray longer but never shorten the guideline window.
 */
export function extendClearance(prev: OwnerState, nowDay: number): OwnerState {
  const from = Math.max(prev.clearUntilDay ?? nowDay, nowDay);
  return { ...prev, clearUntilDay: from + CLEARANCE_WINDOW_DAYS };
}

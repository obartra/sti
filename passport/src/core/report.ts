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
  badgeGates,
  computeBadge,
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
  /**
   * The epoch day (UTC, see core/clock) the test was taken, from the report's
   * date field. Undefined falls back to the report day, so an old test is stamped
   * with its real date and ages correctly instead of reading as fresh.
   */
  readonly panelDay?: number | undefined;
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
 *
 * The panel is stamped with the reported test day (`o.panelDay`, falling back to
 * `nowDay` when the date is left at today), so a back-dated test ages from when
 * it was actually taken; the clearance window still arms from `nowDay`, the day
 * the result is recorded.
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
      lastPanelDay: o.panelDay ?? nowDay,
      corePanelComplete: o.corePanelComplete,
      exposedSitesCovered: o.corePanelComplete,
    },
    hiv: o.hiv ?? prev.hiv,
    activeNonHivSti: o.activeNonHivSti,
    clearUntilDay,
  };
}

/**
 * The owner-facing "what blue needs" preview: apply this in-progress report to a
 * copy of the owner state and read back the three requirements a person can act
 * on here (a recent complete panel, clear, an HIV-protection route) plus whether
 * the result will actually show blue. Built from {@link badgeGates} so it tracks
 * the real badge exactly. `prev` should already carry any route the owner just
 * toggled in the report (PrEP / condoms-always); undetectable rides in via `o`.
 */
export interface ReportPreview {
  /** A complete core panel, every exposed site covered, dated within the window. */
  readonly recentPanel: boolean;
  /** No current active non-HIV STI, no detectable HIV, not mid-treatment. */
  readonly clear: boolean;
  /** At least one qualifying HIV-protection route is in place. */
  readonly route: boolean;
  /** Every requirement is met, so the saved result shows blue. */
  readonly willBeBlue: boolean;
}

export function previewReport(
  prev: OwnerState,
  o: ReportOutcome,
  nowDay: number,
): ReportPreview {
  const projected = applyReport(prev, o, nowDay);
  const g = badgeGates(projected, nowDay);
  return {
    recentPanel: g.testedInWindow,
    clear: g.clear && g.hivNotDetectable && g.notInClearance,
    route: g.hasRoute,
    willBeBlue: computeBadge(projected, nowDay) === "blue",
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

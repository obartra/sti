/**
 * Badge resolution: the trust-critical heart of the passport.
 *
 * The badge is COMPUTED from the owner's inputs, never set directly. A viewer
 * only ever sees the output of {@link resolveViewerBadge}: a two-state badge
 * (blue or gray) plus a single route-stating headline. Everything that could
 * decode to a diagnosis is kept out of that output by construction.
 *
 * Mechanics: docs/03-design.md §1. Inputs/values: docs/08-state-space.md §A.
 * Locked decisions this enforces: docs/02-decisions.md (Badge).
 *
 * Scope of this module (increment 1 of the pure core): badge + headline only.
 * Owner-displayed attribute pills (condom-preference, doxy-PEP) and the
 * viewer-resolution/existence layer (private/public/knock) are separate
 * increments and intentionally not here.
 */

export type HivStatus =
  "negative" | "positive_undetectable" | "positive_detectable";

/**
 * Displayed "No condoms" / "Condoms optional" / "Condoms always" + an
 * undeclared `none`. Only `condoms_always`, shown publicly, is also a route.
 */
export type CondomPreference = "none" | "raw" | "either" | "condoms_always";

export interface TestingInput {
  /**
   * Epoch day (UTC, see core/clock) of the most recent core-panel result, or
   * null when never tested. Absolute, not a relative age, so freshness ages with
   * the wall clock instead of freezing at report time; the relative age is
   * derived as `nowDay - lastPanelDay`. Never-tested (null) is always gray.
   */
  readonly lastPanelDay: number | null;
  /** The standard core panel (HIV, syphilis, gonorrhea, chlamydia) was complete. */
  readonly corePanelComplete: boolean;
  /**
   * Every *exposed* site was covered (per-site "tested clear OR not exposed").
   * Computed on-device, NEVER surfaced to a viewer.
   */
  readonly exposedSitesCovered: boolean;
}

export interface OwnerState {
  readonly testing: TestingInput;
  readonly hiv: HivStatus;
  /**
   * A current active non-HIV STI (untreated bacterial). Prior-treated syphilis
   * serology (serofast) is NOT this; a reinfection (rising titer) is. That
   * distinction is made upstream at report time; here it is a single boolean.
   */
  readonly activeNonHivSti: boolean;
  readonly onPrep: boolean;
  readonly condomPreference: CondomPreference;
  /** The condom preference is shown publicly (required for the condoms-always route). */
  readonly condomPreferencePublic: boolean;
  /**
   * On doxycycline post-exposure prophylaxis. A self-declared flat attribute
   * (doc 03 §3): shown as an optional label when set, NEVER a route and never
   * summed into the badge, so it does not affect computeBadge.
   */
  readonly onDoxyPep: boolean;
  /** Manual pause; forces gray, indistinguishable from any other gray. */
  readonly paused: boolean;
  /**
   * Auto-pause through the post-treatment clearance window: the epoch day until
   * which a reported positive holds the badge gray on its own (computed on-device
   * from the result + treatment day, doc 02/03). null = no active window. It
   * survives a later "cleared" report and can be EXTENDED but never shortened, so
   * the owner cannot lift it before the guideline window passes.
   */
  readonly clearUntilDay: number | null;
}

export type Badge = "blue" | "gray";

export type Headline =
  | "Tested & on HIV prevention"
  | "Tested & always uses condoms"
  | "No status shared right now";

export interface ViewerBadge {
  readonly badge: Badge;
  readonly headline: Headline;
}

/** The single neutral gray output. Every gray reason resolves to exactly this. */
export const GRAY_VIEW: ViewerBadge = {
  badge: "gray",
  headline: "No status shared right now",
};

export const TESTING_WINDOW_DAYS = 90;

/**
 * The standard post-treatment clearance window (days). After a reported positive,
 * the badge auto-pauses for this long from the treatment day, matching the common
 * "abstain ~7 days after treatment" guidance. A single flat window for v0.
 */
export const CLEARANCE_WINDOW_DAYS = 7;

/** True while a reported positive's clearance window has not yet passed. */
export function inClearanceWindow(s: OwnerState, nowDay: number): boolean {
  return s.clearUntilDay !== null && nowDay < s.clearUntilDay;
}

/**
 * Days since the last complete panel as of `nowDay`, or null when never tested.
 * Clamped at 0 so a future-dated result (clock skew across devices) reads as
 * "today" rather than a negative age.
 */
export function panelAgeDays(t: TestingInput, nowDay: number): number | null {
  if (t.lastPanelDay === null) return null;
  return Math.max(0, nowDay - t.lastPanelDay);
}

function testedInWindow(t: TestingInput, nowDay: number): boolean {
  const age = panelAgeDays(t, nowDay);
  return (
    age !== null &&
    age <= TESTING_WINDOW_DAYS &&
    t.corePanelComplete &&
    t.exposedSitesCovered
  );
}

/** Clear = no current active non-HIV STI. Serofast syphilis does not break it. */
function isClear(s: OwnerState): boolean {
  return !s.activeNonHivSti;
}

/** Detectable HIV blocks blue regardless of any route (docs/02 + docs/03 §1). */
function detectableHivBlocks(s: OwnerState): boolean {
  return s.hiv === "positive_detectable";
}

/** PrEP or undetectable: the shared "On HIV prevention" umbrella route. */
export function umbrellaRoutePresent(s: OwnerState): boolean {
  return s.onPrep || s.hiv === "positive_undetectable";
}

/** The public "condoms always" route. */
export function condomRoutePresent(s: OwnerState): boolean {
  return s.condomPreference === "condoms_always" && s.condomPreferencePublic;
}

function hasQualifyingRoute(s: OwnerState): boolean {
  return umbrellaRoutePresent(s) || condomRoutePresent(s);
}

/**
 * The individual blue requirements, each as a pass/fail. Blue is every gate
 * passing; gray is any one failing. This is the single source of truth shared by
 * {@link computeBadge} and the owner-facing "what blue needs" report preview, so
 * the checklist a person sees can never drift from the badge they actually get.
 */
export interface BadgeGates {
  /** Not manually paused. */
  readonly notPaused: boolean;
  /** Not inside a reported positive's post-treatment clearance window. */
  readonly notInClearance: boolean;
  /** HIV is not positive-and-detectable (a hard blocker, independent of route). */
  readonly hivNotDetectable: boolean;
  /** A complete core panel with every exposed site covered, within the window. */
  readonly testedInWindow: boolean;
  /** No current active non-HIV STI. */
  readonly clear: boolean;
  /** At least one qualifying HIV-protection route (PrEP / undetectable / condoms). */
  readonly hasRoute: boolean;
}

/** Evaluate every blue requirement against the owner state as of `nowDay`. */
export function badgeGates(s: OwnerState, nowDay: number): BadgeGates {
  return {
    notPaused: !s.paused,
    notInClearance: !inClearanceWindow(s, nowDay),
    hivNotDetectable: !detectableHivBlocks(s),
    testedInWindow: testedInWindow(s.testing, nowDay),
    clear: isClear(s),
    hasRoute: hasQualifyingRoute(s),
  };
}

/**
 * Blue requires ALL of: not paused; not detectable-HIV; tested in window (as of
 * `nowDay`); clear; and at least one qualifying HIV-protection route. Else gray.
 * `nowDay` is supplied by the caller (core/clock) so this stays pure.
 */
export function computeBadge(s: OwnerState, nowDay: number): Badge {
  const g = badgeGates(s, nowDay);
  const blue =
    g.notPaused &&
    g.notInClearance &&
    g.hivNotDetectable &&
    g.testedInWindow &&
    g.clear &&
    g.hasRoute;
  return blue ? "blue" : "gray";
}

/**
 * The only viewer-facing output. Gray collapses to the single neutral line, so
 * no gray reason is decodable. On blue, the headline states the route that
 * earned blue exactly once; the PrEP/undetectable umbrella wins precedence, so
 * "On HIV prevention" never distinguishes the two and never appears for a
 * condom-only blue.
 */
export function resolveViewerBadge(s: OwnerState, nowDay: number): ViewerBadge {
  if (computeBadge(s, nowDay) === "gray") return GRAY_VIEW;
  const headline: Headline = umbrellaRoutePresent(s)
    ? "Tested & on HIV prevention"
    : "Tested & always uses condoms";
  return { badge: "blue", headline };
}

/** A fresh owner: never tested, no routes, so the badge is gray. */
export const INITIAL_OWNER_STATE: OwnerState = {
  testing: {
    lastPanelDay: null,
    corePanelComplete: false,
    exposedSitesCovered: false,
  },
  hiv: "negative",
  activeNonHivSti: false,
  onPrep: false,
  condomPreference: "none",
  condomPreferencePublic: false,
  onDoxyPep: false,
  paused: false,
  clearUntilDay: null,
};

// Keyed by the union so a new variant fails to compile here (forcing the
// validator to be updated) instead of being silently rejected as invalid.
const HIV_STATUSES: Record<HivStatus, true> = {
  negative: true,
  positive_undetectable: true,
  positive_detectable: true,
};
const CONDOM_PREFS: Record<CondomPreference, true> = {
  none: true,
  raw: true,
  either: true,
  condoms_always: true,
};

/** A non-negative integer epoch day, or null (the "absent" sentinel). */
function isEpochDayOrNull(x: unknown): boolean {
  return x === null || (typeof x === "number" && Number.isInteger(x) && x >= 0);
}

function isTestingInput(x: unknown): x is TestingInput {
  if (typeof x !== "object" || x === null) return false;
  const t = x as Record<string, unknown>;
  return (
    isEpochDayOrNull(t.lastPanelDay) &&
    typeof t.corePanelComplete === "boolean" &&
    typeof t.exposedSitesCovered === "boolean"
  );
}

const isHivStatus = (x: unknown): x is HivStatus =>
  typeof x === "string" && Object.hasOwn(HIV_STATUSES, x);
const isCondomPref = (x: unknown): x is CondomPreference =>
  typeof x === "string" && Object.hasOwn(CONDOM_PREFS, x);

/** Strict runtime validation of OwnerState, for the synced account blob. */
export function isOwnerState(x: unknown): x is OwnerState {
  if (typeof x !== "object" || x === null) return false;
  const s = x as Record<string, unknown>;
  return (
    isTestingInput(s.testing) &&
    isHivStatus(s.hiv) &&
    typeof s.activeNonHivSti === "boolean" &&
    typeof s.onPrep === "boolean" &&
    isCondomPref(s.condomPreference) &&
    typeof s.condomPreferencePublic === "boolean" &&
    typeof s.onDoxyPep === "boolean" &&
    typeof s.paused === "boolean" &&
    isEpochDayOrNull(s.clearUntilDay)
  );
}

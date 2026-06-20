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
  | "negative"
  | "positive_undetectable"
  | "positive_detectable";

/**
 * Displayed "No condoms" / "Condoms optional" / "Condoms always" + an
 * undeclared `none`. Only `condoms_always`, shown publicly, is also a route.
 */
export type CondomPreference = "none" | "raw" | "either" | "condoms_always";

export interface TestingInput {
  /** Has a real result ever been entered? Never-tested is always gray. */
  readonly hasEverTested: boolean;
  /** Days since the most recent core-panel result. */
  readonly lastPanelAgeDays: number;
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
  /** Manual or auto pause; either forces gray, indistinguishable from any other gray. */
  readonly paused: boolean;
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

function testedInWindow(t: TestingInput): boolean {
  return (
    t.hasEverTested &&
    t.lastPanelAgeDays <= TESTING_WINDOW_DAYS &&
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
 * Blue requires ALL of: not paused; not detectable-HIV; tested in window;
 * clear; and at least one qualifying HIV-protection route. Else gray.
 */
export function computeBadge(s: OwnerState): Badge {
  if (s.paused) return "gray";
  if (detectableHivBlocks(s)) return "gray";
  if (!testedInWindow(s.testing)) return "gray";
  if (!isClear(s)) return "gray";
  if (!hasQualifyingRoute(s)) return "gray";
  return "blue";
}

/**
 * The only viewer-facing output. Gray collapses to the single neutral line, so
 * no gray reason is decodable. On blue, the headline states the route that
 * earned blue exactly once; the PrEP/undetectable umbrella wins precedence, so
 * "On HIV prevention" never distinguishes the two and never appears for a
 * condom-only blue.
 */
export function resolveViewerBadge(s: OwnerState): ViewerBadge {
  if (computeBadge(s) === "gray") return GRAY_VIEW;
  const headline: Headline = umbrellaRoutePresent(s)
    ? "Tested & on HIV prevention"
    : "Tested & always uses condoms";
  return { badge: "blue", headline };
}

/** A fresh owner: never tested, no routes, so the badge is gray. */
export const INITIAL_OWNER_STATE: OwnerState = {
  testing: {
    hasEverTested: false,
    lastPanelAgeDays: 0,
    corePanelComplete: false,
    exposedSitesCovered: false,
  },
  hiv: "negative",
  activeNonHivSti: false,
  onPrep: false,
  condomPreference: "none",
  condomPreferencePublic: false,
  paused: false,
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

function isTestingInput(x: unknown): x is TestingInput {
  if (typeof x !== "object" || x === null) return false;
  const t = x as Record<string, unknown>;
  return (
    typeof t.hasEverTested === "boolean" &&
    typeof t.lastPanelAgeDays === "number" &&
    Number.isFinite(t.lastPanelAgeDays) &&
    t.lastPanelAgeDays >= 0 &&
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
    typeof s.paused === "boolean"
  );
}

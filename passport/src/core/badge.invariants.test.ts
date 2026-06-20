import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  computeBadge,
  GRAY_VIEW,
  resolveViewerBadge,
  type CondomPreference,
  type OwnerState,
} from "./badge.ts";
import { NOW_DAY } from "./badge.fixtures.ts";

const ownerStateArb: fc.Arbitrary<OwnerState> = fc.record({
  testing: fc.record({
    // An absolute epoch day around NOW_DAY, or null (never tested).
    lastPanelDay: fc.option(fc.integer({ min: NOW_DAY - 400, max: NOW_DAY }), {
      nil: null,
    }),
    corePanelComplete: fc.boolean(),
    exposedSitesCovered: fc.boolean(),
  }),
  hiv: fc.constantFrom(
    "negative",
    "positive_undetectable",
    "positive_detectable",
  ),
  activeNonHivSti: fc.boolean(),
  onPrep: fc.boolean(),
  condomPreference: fc.constantFrom("none", "raw", "either", "condoms_always"),
  condomPreferencePublic: fc.boolean(),
  onDoxyPep: fc.boolean(),
  paused: fc.boolean(),
});

const UMBRELLA_VIEW = {
  badge: "blue",
  headline: "Tested & on HIV prevention",
} as const;
const CONDOM_VIEW = {
  badge: "blue",
  headline: "Tested & always uses condoms",
} as const;
const ALLOWED_VIEWS = [UMBRELLA_VIEW, CONDOM_VIEW, GRAY_VIEW];

// A blue-eligible owner MINUS the HIV-protection route (the route is set per
// test), so the blue branch is exercised on every run instead of the ~0.5% of
// random inputs that happen to reach blue.
const blueBaseArb = fc.record({
  lastPanelDay: fc.integer({ min: NOW_DAY - 90, max: NOW_DAY }),
  condomPreference: fc.constantFrom("none", "raw", "either", "condoms_always"),
  condomPreferencePublic: fc.boolean(),
});

function blueBase(b: {
  lastPanelDay: number;
  condomPreference: CondomPreference;
  condomPreferencePublic: boolean;
}): Omit<OwnerState, "onPrep" | "hiv"> {
  return {
    testing: {
      lastPanelDay: b.lastPanelDay,
      corePanelComplete: true,
      exposedSitesCovered: true,
    },
    activeNonHivSti: false,
    condomPreference: b.condomPreference,
    condomPreferencePublic: b.condomPreferencePublic,
    onDoxyPep: false,
    paused: false,
  };
}

describe("badge invariants (exhaustive)", () => {
  it("never-tested is always gray", () => {
    fc.assert(
      fc.property(ownerStateArb, (s) => {
        const state = { ...s, testing: { ...s.testing, lastPanelDay: null } };
        return computeBadge(state, NOW_DAY) === "gray";
      }),
    );
  });

  it("detectable HIV is gray regardless of route", () => {
    fc.assert(
      fc.property(ownerStateArb, (s) => {
        const state: OwnerState = { ...s, hiv: "positive_detectable" };
        return computeBadge(state, NOW_DAY) === "gray";
      }),
    );
  });

  it("pausing is always gray", () => {
    fc.assert(
      fc.property(ownerStateArb, (s) => {
        return computeBadge({ ...s, paused: true }, NOW_DAY) === "gray";
      }),
    );
  });

  it("blue implies every precondition held", () => {
    fc.assert(
      fc.property(ownerStateArb, (s) => {
        if (computeBadge(s, NOW_DAY) !== "blue") return true;
        const hasRoute =
          s.onPrep ||
          s.hiv === "positive_undetectable" ||
          (s.condomPreference === "condoms_always" && s.condomPreferencePublic);
        return (
          !s.paused &&
          s.hiv !== "positive_detectable" &&
          s.testing.lastPanelDay !== null &&
          NOW_DAY - s.testing.lastPanelDay <= 90 &&
          s.testing.corePanelComplete &&
          s.testing.exposedSitesCovered &&
          !s.activeNonHivSti &&
          hasRoute
        );
      }),
    );
  });

  it("non-decodability: every gray resolves to the one neutral view", () => {
    fc.assert(
      fc.property(ownerStateArb, (s) => {
        if (computeBadge(s, NOW_DAY) !== "gray") return true;
        expect(resolveViewerBadge(s, NOW_DAY)).toEqual(GRAY_VIEW);
        return true;
      }),
    );
  });

  it("camouflage: PrEP and undetectable are byte-identical to a viewer", () => {
    fc.assert(
      fc.property(ownerStateArb, (s) => {
        const viaPrep: OwnerState = { ...s, onPrep: true, hiv: "negative" };
        const viaUndetectable: OwnerState = {
          ...s,
          onPrep: false,
          hiv: "positive_undetectable",
        };
        expect(resolveViewerBadge(viaPrep, NOW_DAY)).toEqual(
          resolveViewerBadge(viaUndetectable, NOW_DAY),
        );
        return true;
      }),
    );
  });

  it("a condom-only blue never shows the umbrella headline", () => {
    fc.assert(
      fc.property(ownerStateArb, (s) => {
        const view = resolveViewerBadge(s, NOW_DAY);
        if (view.badge !== "blue") return true;
        const umbrella = s.onPrep || s.hiv === "positive_undetectable";
        return umbrella
          ? view.headline === "Tested & on HIV prevention"
          : view.headline === "Tested & always uses condoms";
      }),
    );
  });

  // The two properties above guard the whole input space but reach a *blue*
  // condom-only / umbrella case on well under 1% of random runs. The two below
  // force the blue branch every run and pin the exact viewer output, so the
  // camouflage and condom-only headline guarantees are actually proven.

  it("camouflage (blue): PrEP and undetectable both resolve to the exact umbrella view", () => {
    fc.assert(
      fc.property(blueBaseArb, (b) => {
        const base = blueBase(b);
        const viaPrep: OwnerState = { ...base, onPrep: true, hiv: "negative" };
        const viaUndetectable: OwnerState = {
          ...base,
          onPrep: false,
          hiv: "positive_undetectable",
        };
        expect(resolveViewerBadge(viaPrep, NOW_DAY)).toEqual(UMBRELLA_VIEW);
        expect(resolveViewerBadge(viaUndetectable, NOW_DAY)).toEqual(
          UMBRELLA_VIEW,
        );
        return true;
      }),
    );
  });

  it("condom-only blue resolves to the exact condoms headline", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: NOW_DAY - 90, max: NOW_DAY }),
        (lastPanelDay) => {
          const s: OwnerState = {
            testing: {
              lastPanelDay,
              corePanelComplete: true,
              exposedSitesCovered: true,
            },
            hiv: "negative",
            activeNonHivSti: false,
            onPrep: false,
            condomPreference: "condoms_always",
            condomPreferencePublic: true,
            onDoxyPep: false,
            paused: false,
          };
          expect(resolveViewerBadge(s, NOW_DAY)).toEqual(CONDOM_VIEW);
          return true;
        },
      ),
    );
  });

  it("the viewer output is always one of exactly three shapes", () => {
    fc.assert(
      fc.property(ownerStateArb, (s) => {
        const view = resolveViewerBadge(s, NOW_DAY);
        return ALLOWED_VIEWS.some(
          (allowed) =>
            allowed.badge === view.badge && allowed.headline === view.headline,
        );
      }),
    );
  });
});

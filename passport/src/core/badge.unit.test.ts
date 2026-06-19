import { describe, expect, it } from "vitest";
import {
  computeBadge,
  isOwnerState,
  INITIAL_OWNER_STATE,
  type OwnerState,
} from "./badge.ts";
import { blueEligible } from "./badge.fixtures.ts";

describe("isOwnerState", () => {
  it("accepts well-formed states", () => {
    expect(isOwnerState(INITIAL_OWNER_STATE)).toBe(true);
    expect(isOwnerState(blueEligible())).toBe(true);
  });

  const bad: Record<string, unknown> = {
    "a non-object": 5,
    "a missing testing object": { ...blueEligible(), testing: undefined },
    "a NaN lastPanelAgeDays": {
      ...blueEligible(),
      testing: { ...blueEligible().testing, lastPanelAgeDays: NaN },
    },
    "a negative lastPanelAgeDays": {
      ...blueEligible(),
      testing: { ...blueEligible().testing, lastPanelAgeDays: -1 },
    },
    "a non-boolean paused": { ...blueEligible(), paused: "yes" },
    "an invalid hiv status": { ...blueEligible(), hiv: "maybe" },
    "an invalid condom preference": {
      ...blueEligible(),
      condomPreference: "sometimes",
    },
  };
  for (const [label, value] of Object.entries(bad)) {
    it(`rejects ${label}`, () => {
      expect(isOwnerState(value)).toBe(false);
    });
  }
});

describe("badge boundaries", () => {
  it("90 days is still in window; 91 is not", () => {
    const at90 = {
      ...blueEligible(),
      testing: { ...blueEligible().testing, lastPanelAgeDays: 90 },
    };
    const at91 = {
      ...blueEligible(),
      testing: { ...blueEligible().testing, lastPanelAgeDays: 91 },
    };
    expect(computeBadge(at90)).toBe("blue");
    expect(computeBadge(at91)).toBe("gray");
  });

  it("the condoms-always route only qualifies when shown publicly", () => {
    const base: OwnerState = {
      ...blueEligible(),
      onPrep: false,
      hiv: "negative",
      condomPreference: "condoms_always",
    };
    expect(computeBadge({ ...base, condomPreferencePublic: false })).toBe(
      "gray",
    );
    expect(computeBadge({ ...base, condomPreferencePublic: true })).toBe(
      "blue",
    );
  });

  it("a current active non-HIV STI grays; clearing it restores blue", () => {
    expect(computeBadge({ ...blueEligible(), activeNonHivSti: true })).toBe(
      "gray",
    );
    expect(computeBadge({ ...blueEligible(), activeNonHivSti: false })).toBe(
      "blue",
    );
  });
});

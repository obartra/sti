import { describe, expect, it } from "vitest";
import {
  computeBadge,
  panelAgeDays,
  isOwnerState,
  INITIAL_OWNER_STATE,
  type OwnerState,
} from "./badge.ts";
import { blueEligible, daysAgo, NOW_DAY } from "./badge.fixtures.ts";

describe("isOwnerState", () => {
  it("accepts well-formed states", () => {
    expect(isOwnerState(INITIAL_OWNER_STATE)).toBe(true);
    expect(isOwnerState(blueEligible())).toBe(true);
  });

  const bad: Record<string, unknown> = {
    "a non-object": 5,
    "a missing testing object": { ...blueEligible(), testing: undefined },
    "a non-integer lastPanelDay": {
      ...blueEligible(),
      testing: { ...blueEligible().testing, lastPanelDay: 1.5 },
    },
    "a negative lastPanelDay": {
      ...blueEligible(),
      testing: { ...blueEligible().testing, lastPanelDay: -1 },
    },
    "a non-boolean paused": { ...blueEligible(), paused: "yes" },
    "a non-integer clearUntilDay": { ...blueEligible(), clearUntilDay: 1.5 },
    "a negative clearUntilDay": { ...blueEligible(), clearUntilDay: -1 },
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
      testing: { ...blueEligible().testing, lastPanelDay: daysAgo(90) },
    };
    const at91 = {
      ...blueEligible(),
      testing: { ...blueEligible().testing, lastPanelDay: daysAgo(91) },
    };
    expect(computeBadge(at90, NOW_DAY)).toBe("blue");
    expect(computeBadge(at91, NOW_DAY)).toBe("gray");
  });

  it("the condoms-always route only qualifies when shown publicly", () => {
    const base: OwnerState = {
      ...blueEligible(),
      onPrep: false,
      hiv: "negative",
      condomPreference: "condoms_always",
    };
    expect(
      computeBadge({ ...base, condomPreferencePublic: false }, NOW_DAY),
    ).toBe("gray");
    expect(
      computeBadge({ ...base, condomPreferencePublic: true }, NOW_DAY),
    ).toBe("blue");
  });

  it("a current active non-HIV STI grays; clearing it restores blue", () => {
    expect(
      computeBadge({ ...blueEligible(), activeNonHivSti: true }, NOW_DAY),
    ).toBe("gray");
    expect(
      computeBadge({ ...blueEligible(), activeNonHivSti: false }, NOW_DAY),
    ).toBe("blue");
  });

  it("the same stored state ages from blue to gray as time advances", () => {
    // The point of the absolute-day model: a result frozen at report time does
    // not stay fresh forever. One unchanged state, evaluated at two days.
    const s = blueEligible(); // last panel on daysAgo(10)
    const lastDay = s.testing.lastPanelDay ?? 0;
    expect(computeBadge(s, lastDay + 90)).toBe("blue"); // last in-window day
    expect(computeBadge(s, lastDay + 91)).toBe("gray"); // lapsed the next day
  });

  it("a future-dated panel (clock skew) reads as today, never negative age", () => {
    const s = blueEligible();
    const lastDay = s.testing.lastPanelDay ?? 0;
    // now is BEFORE the recorded panel day: age clamps to 0, still in window.
    expect(computeBadge(s, lastDay - 5)).toBe("blue");
    expect(panelAgeDays(s.testing, lastDay - 5)).toBe(0);
  });

  it("a clearance window grays an otherwise-blue owner until it passes", () => {
    // Otherwise fully blue, but inside a reported positive's clearance window.
    const s = { ...blueEligible(), clearUntilDay: NOW_DAY + 3 };
    expect(computeBadge(s, NOW_DAY)).toBe("gray"); // inside the window
    expect(computeBadge(s, NOW_DAY + 2)).toBe("gray"); // still inside
    // The window is exclusive at its end day: on/after it, blue returns.
    expect(computeBadge(s, NOW_DAY + 3)).toBe("blue");
    expect(computeBadge(s, NOW_DAY + 4)).toBe("blue");
  });
});

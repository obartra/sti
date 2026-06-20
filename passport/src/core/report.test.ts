import { describe, it, expect } from "vitest";
import { applyReport, type ReportOutcome } from "./report.ts";
import { INITIAL_OWNER_STATE, computeBadge, type OwnerState } from "./badge.ts";

const onPrep: OwnerState = { ...INITIAL_OWNER_STATE, onPrep: true };

const clearNegative: ReportOutcome = {
  hiv: "negative",
  corePanelComplete: true,
  activeNonHivSti: false,
};

describe("applyReport", () => {
  it("marks tested-now and records the result fields", () => {
    const next = applyReport(INITIAL_OWNER_STATE, clearNegative);
    expect(next.testing).toEqual({
      hasEverTested: true,
      lastPanelAgeDays: 0,
      corePanelComplete: true,
      exposedSitesCovered: true,
    });
    expect(next.hiv).toBe("negative");
    expect(next.activeNonHivSti).toBe(false);
  });

  it("preserves the route fields a test does not speak to (PrEP, condom, pause)", () => {
    const prev: OwnerState = {
      ...INITIAL_OWNER_STATE,
      onPrep: true,
      condomPreference: "condoms_always",
      condomPreferencePublic: true,
      paused: true,
    };
    const next = applyReport(prev, clearNegative);
    expect(next.onPrep).toBe(true);
    expect(next.condomPreference).toBe("condoms_always");
    expect(next.condomPreferencePublic).toBe(true);
    expect(next.paused).toBe(true);
  });

  it("a clear complete panel earns blue only with a route: PrEP yes, bare negative no", () => {
    // Same report; the difference is whether a qualifying route already exists.
    expect(computeBadge(applyReport(onPrep, clearNegative))).toBe("blue");
    expect(computeBadge(applyReport(INITIAL_OWNER_STATE, clearNegative))).toBe(
      "gray",
    );
  });

  it("undetectable HIV is its own route: a clear complete panel turns blue", () => {
    const next = applyReport(INITIAL_OWNER_STATE, {
      hiv: "positive_undetectable",
      corePanelComplete: true,
      activeNonHivSti: false,
    });
    expect(computeBadge(next)).toBe("blue");
  });

  it("a non-HIV positive is gray even on PrEP (not clear)", () => {
    const next = applyReport(onPrep, {
      hiv: "negative",
      corePanelComplete: true,
      activeNonHivSti: true,
    });
    expect(next.activeNonHivSti).toBe(true);
    expect(computeBadge(next)).toBe("gray");
  });

  it("preserves the prior HIV status when the report did not test HIV", () => {
    // A syph/gc/ct-only detail report (hiv omitted) must not reset U=U.
    const prev: OwnerState = {
      ...INITIAL_OWNER_STATE,
      hiv: "positive_undetectable",
    };
    const next = applyReport(prev, {
      corePanelComplete: false,
      activeNonHivSti: true,
    });
    expect(next.hiv).toBe("positive_undetectable");
  });

  it("always records the result as tested-today (age 0)", () => {
    // The badge's freshness window relies on this; pinned so a future editable
    // date field is forced to revisit applyReport rather than read stale-as-fresh.
    const stale: OwnerState = {
      ...onPrep,
      testing: { ...INITIAL_OWNER_STATE.testing, lastPanelAgeDays: 200 },
    };
    expect(applyReport(stale, clearNegative).testing.lastPanelAgeDays).toBe(0);
  });

  it("an incomplete core panel stays gray even when clear and on a route", () => {
    const next = applyReport(onPrep, {
      hiv: "negative",
      corePanelComplete: false,
      activeNonHivSti: false,
    });
    expect(computeBadge(next)).toBe("gray");
  });
});

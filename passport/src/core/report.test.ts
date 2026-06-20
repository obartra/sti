import { describe, it, expect } from "vitest";
import { applyReport, type ReportOutcome } from "./report.ts";
import { INITIAL_OWNER_STATE, computeBadge, type OwnerState } from "./badge.ts";
import { NOW_DAY, daysAgo } from "./badge.fixtures.ts";

const onPrep: OwnerState = { ...INITIAL_OWNER_STATE, onPrep: true };

const clearNegative: ReportOutcome = {
  hiv: "negative",
  corePanelComplete: true,
  activeNonHivSti: false,
};

describe("applyReport", () => {
  it("stamps the panel with the report day and records the result fields", () => {
    const next = applyReport(INITIAL_OWNER_STATE, clearNegative, NOW_DAY);
    expect(next.testing).toEqual({
      lastPanelDay: NOW_DAY,
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
    const next = applyReport(prev, clearNegative, NOW_DAY);
    expect(next.onPrep).toBe(true);
    expect(next.condomPreference).toBe("condoms_always");
    expect(next.condomPreferencePublic).toBe(true);
    expect(next.paused).toBe(true);
  });

  it("a clear complete panel earns blue only with a route: PrEP yes, bare negative no", () => {
    // Same report; the difference is whether a qualifying route already exists.
    expect(
      computeBadge(applyReport(onPrep, clearNegative, NOW_DAY), NOW_DAY),
    ).toBe("blue");
    expect(
      computeBadge(
        applyReport(INITIAL_OWNER_STATE, clearNegative, NOW_DAY),
        NOW_DAY,
      ),
    ).toBe("gray");
  });

  it("undetectable HIV is its own route: a clear complete panel turns blue", () => {
    const next = applyReport(
      INITIAL_OWNER_STATE,
      {
        hiv: "positive_undetectable",
        corePanelComplete: true,
        activeNonHivSti: false,
      },
      NOW_DAY,
    );
    expect(computeBadge(next, NOW_DAY)).toBe("blue");
  });

  it("a non-HIV positive is gray even on PrEP (not clear)", () => {
    const next = applyReport(
      onPrep,
      {
        hiv: "negative",
        corePanelComplete: true,
        activeNonHivSti: true,
      },
      NOW_DAY,
    );
    expect(next.activeNonHivSti).toBe(true);
    expect(computeBadge(next, NOW_DAY)).toBe("gray");
  });

  it("preserves the prior HIV status when the report did not test HIV", () => {
    // A syph/gc/ct-only detail report (hiv omitted) must not reset U=U.
    const prev: OwnerState = {
      ...INITIAL_OWNER_STATE,
      hiv: "positive_undetectable",
    };
    const next = applyReport(
      prev,
      {
        corePanelComplete: false,
        activeNonHivSti: true,
      },
      NOW_DAY,
    );
    expect(next.hiv).toBe("positive_undetectable");
  });

  it("stamps the result with the report day, overwriting a stale prior date", () => {
    // The badge's freshness window relies on this; pinned so a future editable
    // date field is forced to revisit applyReport rather than read stale-as-fresh.
    const stale: OwnerState = {
      ...onPrep,
      testing: { ...INITIAL_OWNER_STATE.testing, lastPanelDay: daysAgo(200) },
    };
    expect(
      applyReport(stale, clearNegative, NOW_DAY).testing.lastPanelDay,
    ).toBe(NOW_DAY);
  });

  it("an incomplete core panel stays gray even when clear and on a route", () => {
    const next = applyReport(
      onPrep,
      {
        hiv: "negative",
        corePanelComplete: false,
        activeNonHivSti: false,
      },
      NOW_DAY,
    );
    expect(computeBadge(next, NOW_DAY)).toBe("gray");
  });
});

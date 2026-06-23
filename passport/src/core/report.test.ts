import { describe, it, expect } from "vitest";
import {
  applyReport,
  extendClearance,
  previewReport,
  type ReportOutcome,
} from "./report.ts";
import {
  INITIAL_OWNER_STATE,
  computeBadge,
  CLEARANCE_WINDOW_DAYS,
  type OwnerState,
} from "./badge.ts";
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

  const positive: ReportOutcome = {
    hiv: "negative",
    corePanelComplete: true,
    activeNonHivSti: true,
  };

  it("a reported positive arms the clearance window from the report day", () => {
    const next = applyReport(onPrep, positive, NOW_DAY);
    expect(next.clearUntilDay).toBe(NOW_DAY + CLEARANCE_WINDOW_DAYS);
    expect(computeBadge(next, NOW_DAY)).toBe("gray");
  });

  it("a later cleared report keeps the badge gray until the window passes", () => {
    // Report positive (day NOW), then report clear two days later.
    const afterPositive = applyReport(onPrep, positive, NOW_DAY);
    const afterClear = applyReport(afterPositive, clearNegative, NOW_DAY + 2);
    // Treated/clear (activeNonHivSti false) but still inside the window: gray.
    expect(afterClear.activeNonHivSti).toBe(false);
    expect(afterClear.clearUntilDay).toBe(NOW_DAY + CLEARANCE_WINDOW_DAYS);
    expect(computeBadge(afterClear, NOW_DAY + 2)).toBe("gray");
    // Once the window passes, the clear + route earns blue.
    expect(computeBadge(afterClear, NOW_DAY + CLEARANCE_WINDOW_DAYS)).toBe(
      "blue",
    );
  });

  it("a clear report never shortens an active clearance window", () => {
    const armed: OwnerState = { ...onPrep, clearUntilDay: NOW_DAY + 5 };
    const next = applyReport(armed, clearNegative, NOW_DAY);
    expect(next.clearUntilDay).toBe(NOW_DAY + 5); // preserved, not cleared
  });

  it("stamps the panel with the chosen test day when panelDay is given", () => {
    const day = daysAgo(30);
    const next = applyReport(
      onPrep,
      { ...clearNegative, panelDay: day },
      NOW_DAY,
    );
    expect(next.testing.lastPanelDay).toBe(day);
  });

  it("a back-dated panel past the window reads as gray, not fresh", () => {
    // A complete clear panel on a route, but dated 200 days ago: out of window.
    const next = applyReport(
      onPrep,
      { ...clearNegative, panelDay: daysAgo(200) },
      NOW_DAY,
    );
    expect(computeBadge(next, NOW_DAY)).toBe("gray");
  });

  it("a non-HIV positive arms the clearance window from now, not the test day", () => {
    // Even a back-dated positive holds the badge through the window from today.
    const next = applyReport(
      onPrep,
      {
        hiv: "negative",
        corePanelComplete: true,
        activeNonHivSti: true,
        panelDay: daysAgo(3),
      },
      NOW_DAY,
    );
    expect(next.clearUntilDay).toBe(NOW_DAY + CLEARANCE_WINDOW_DAYS);
  });

  it("extendClearance lengthens the window and never shortens it", () => {
    const armed: OwnerState = { ...onPrep, clearUntilDay: NOW_DAY + 3 };
    const extended = extendClearance(armed, NOW_DAY);
    expect(extended.clearUntilDay).toBe(NOW_DAY + 3 + CLEARANCE_WINDOW_DAYS);

    // With no active window, it extends from now.
    const fresh = extendClearance(onPrep, NOW_DAY);
    expect(fresh.clearUntilDay).toBe(NOW_DAY + CLEARANCE_WINDOW_DAYS);

    // A stale (past) window extends from now, not from the past day.
    const stale: OwnerState = { ...onPrep, clearUntilDay: NOW_DAY - 10 };
    expect(extendClearance(stale, NOW_DAY).clearUntilDay).toBe(
      NOW_DAY + CLEARANCE_WINDOW_DAYS,
    );
  });
});

describe("previewReport", () => {
  it("a clear complete panel on a route reads all-met and will be blue", () => {
    const p = previewReport(onPrep, clearNegative, NOW_DAY);
    expect(p).toEqual({
      recentPanel: true,
      clear: true,
      route: true,
      willBeBlue: true,
    });
  });

  it("the same panel with no route: only the route requirement is unmet", () => {
    const p = previewReport(INITIAL_OWNER_STATE, clearNegative, NOW_DAY);
    expect(p.recentPanel).toBe(true);
    expect(p.clear).toBe(true);
    expect(p.route).toBe(false);
    expect(p.willBeBlue).toBe(false);
  });

  it("an incomplete panel leaves the recent-panel requirement unmet", () => {
    const p = previewReport(
      onPrep,
      { hiv: "negative", corePanelComplete: false, activeNonHivSti: false },
      NOW_DAY,
    );
    expect(p.recentPanel).toBe(false);
    expect(p.willBeBlue).toBe(false);
  });

  it("an active non-HIV positive leaves the clear requirement unmet", () => {
    const p = previewReport(
      onPrep,
      { hiv: "negative", corePanelComplete: true, activeNonHivSti: true },
      NOW_DAY,
    );
    expect(p.clear).toBe(false);
    expect(p.willBeBlue).toBe(false);
  });

  it("detectable HIV leaves the clear requirement unmet (the hard blocker)", () => {
    const p = previewReport(
      onPrep,
      {
        hiv: "positive_detectable",
        corePanelComplete: true,
        activeNonHivSti: false,
      },
      NOW_DAY,
    );
    expect(p.clear).toBe(false);
    expect(p.willBeBlue).toBe(false);
  });
});

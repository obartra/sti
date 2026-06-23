// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  COPY,
  reportOutcome,
  type ReportState,
  type SiteStatus,
} from "./Report.parts.tsx";

describe("report infections", () => {
  it("asks only about the core panel (no collect-then-discard rows)", () => {
    // Herpes / hep B / HPV are not part of the badge and were never stored, so
    // they were dropped from the report; only the four core-panel infections stay.
    expect(COPY.infections.map((i) => i.id)).toEqual(["hiv", "ct", "gc", "syph"]);
  });
});

// A minimal ReportState: reportOutcome reads only val, siteStatus, coreComplete,
// and panelDay; the rest are inert stubs so the mapping can be tested directly.
function state(over: {
  coreComplete?: boolean;
  panelDay?: number;
  vals?: Record<string, string>;
  sites?: Record<string, SiteStatus>;
}): ReportState {
  const vals = over.vals ?? {};
  const sites = over.sites ?? {};
  return {
    onPassport: true,
    setOnPassport: () => undefined,
    panelDay: over.panelDay ?? 20000,
    setPanelDay: () => undefined,
    val: (id) => vals[id] ?? "Not tested",
    set: () => undefined,
    siteVal: () => "Not tested",
    setSite: () => undefined,
    siteStatus: (id) => sites[id] ?? "untouched",
    anyPositive: false,
    coreComplete: over.coreComplete ?? false,
    coreMissing: [],
    touchedAny: false,
    anyEntered: true,
  };
}

describe("reportOutcome", () => {
  it("leaves HIV unestablished (undefined) when not tested", () => {
    expect(reportOutcome(state({})).hiv).toBeUndefined();
  });

  it("an untouched panel is incomplete (no one-tap all-clear)", () => {
    expect(reportOutcome(state({})).corePanelComplete).toBe(false);
  });

  it("maps the HIV pick (Undetectable is the U=U route)", () => {
    expect(reportOutcome(state({ vals: { hiv: "Undetectable" } })).hiv).toBe(
      "positive_undetectable",
    );
    expect(reportOutcome(state({ vals: { hiv: "Positive" } })).hiv).toBe(
      "positive_detectable",
    );
    expect(reportOutcome(state({ vals: { hiv: "Negative" } })).hiv).toBe(
      "negative",
    );
  });

  it("flags an active non-HIV STI from a positive syphilis or site", () => {
    expect(
      reportOutcome(state({ vals: { syph: "Positive" } })).activeNonHivSti,
    ).toBe(true);
    expect(
      reportOutcome(state({ sites: { gc: "positive" } })).activeNonHivSti,
    ).toBe(true);
    expect(
      reportOutcome(state({ sites: { ct: "positive" } })).activeNonHivSti,
    ).toBe(true);
  });

  it("prior-history syphilis is not an active non-HIV STI", () => {
    expect(
      reportOutcome(state({ vals: { syph: "Prior history" } })).activeNonHivSti,
    ).toBe(false);
  });

  it("carries core-panel completeness through", () => {
    expect(reportOutcome(state({ coreComplete: true })).corePanelComplete).toBe(
      true,
    );
    expect(
      reportOutcome(state({ coreComplete: false })).corePanelComplete,
    ).toBe(false);
  });

  it("carries the chosen test day through as panelDay", () => {
    expect(reportOutcome(state({ panelDay: 19710 })).panelDay).toBe(19710);
  });
});

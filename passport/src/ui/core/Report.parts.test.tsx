// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  reportOutcome,
  type ReportState,
  type SiteStatus,
} from "./Report.parts.tsx";

// A minimal ReportState: reportOutcome reads only detail, val, siteStatus, and
// coreComplete; the rest are inert stubs so the mapping can be tested directly.
function state(over: {
  detail: boolean;
  coreComplete?: boolean;
  vals?: Record<string, string>;
  sites?: Record<string, SiteStatus>;
}): ReportState {
  const vals = over.vals ?? {};
  const sites = over.sites ?? {};
  return {
    mode: over.detail ? "Specific results" : "All negative",
    setMode: () => undefined,
    onPassport: true,
    setOnPassport: () => undefined,
    detail: over.detail,
    val: (id) => vals[id] ?? "Not tested",
    set: () => undefined,
    siteVal: () => "Not tested",
    setSite: () => undefined,
    siteStatus: (id) => sites[id] ?? "untouched",
    anyPositive: false,
    anyChronicPositive: false,
    coreComplete: over.coreComplete ?? false,
    coreMissing: [],
    touchedAny: false,
    anyEntered: true,
  };
}

describe("reportOutcome", () => {
  it("all-negative mode is a complete, clear, HIV-negative panel", () => {
    expect(reportOutcome(state({ detail: false }))).toEqual({
      hiv: "negative",
      corePanelComplete: true,
      activeNonHivSti: false,
    });
  });

  it("leaves HIV unestablished (undefined) when not tested in detail mode", () => {
    expect(reportOutcome(state({ detail: true })).hiv).toBeUndefined();
  });

  it("maps the HIV pick (Undetectable is the U=U route)", () => {
    expect(
      reportOutcome(state({ detail: true, vals: { hiv: "Undetectable" } })).hiv,
    ).toBe("positive_undetectable");
    expect(
      reportOutcome(state({ detail: true, vals: { hiv: "Positive" } })).hiv,
    ).toBe("positive_detectable");
    expect(
      reportOutcome(state({ detail: true, vals: { hiv: "Negative" } })).hiv,
    ).toBe("negative");
  });

  it("flags an active non-HIV STI from a positive syphilis or site", () => {
    expect(
      reportOutcome(state({ detail: true, vals: { syph: "Positive" } }))
        .activeNonHivSti,
    ).toBe(true);
    expect(
      reportOutcome(state({ detail: true, sites: { gc: "positive" } }))
        .activeNonHivSti,
    ).toBe(true);
    expect(
      reportOutcome(state({ detail: true, sites: { ct: "positive" } }))
        .activeNonHivSti,
    ).toBe(true);
  });

  it("prior-history syphilis is not an active non-HIV STI", () => {
    expect(
      reportOutcome(state({ detail: true, vals: { syph: "Prior history" } }))
        .activeNonHivSti,
    ).toBe(false);
  });

  it("carries core-panel completeness through in detail mode", () => {
    expect(
      reportOutcome(state({ detail: true, coreComplete: true }))
        .corePanelComplete,
    ).toBe(true);
    expect(
      reportOutcome(state({ detail: true, coreComplete: false }))
        .corePanelComplete,
    ).toBe(false);
  });
});

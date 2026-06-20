import { describe, it, expect } from "vitest";
import { deriveOwnerCard } from "./ownerCard.ts";
import { NOW_DAY, daysAgo } from "../core/badge.fixtures.ts";
import type { OwnerState } from "../core/badge.ts";

const tested = {
  lastPanelDay: daysAgo(10),
  corePanelComplete: true,
  exposedSitesCovered: true,
};

// Base: blue via PrEP, no public condom preference.
function state(over: Partial<OwnerState> = {}): OwnerState {
  return {
    testing: tested,
    hiv: "negative",
    activeNonHivSti: false,
    onPrep: true,
    condomPreference: "none",
    condomPreferencePublic: false,
    onDoxyPep: false,
    paused: false,
    ...over,
  };
}

// Every card is derived as of NOW_DAY (tested 10 days ago = in window).
const card = (s: OwnerState, handle: string) =>
  deriveOwnerCard(s, handle, NOW_DAY);

describe("deriveOwnerCard", () => {
  it("blue via PrEP: umbrella label + umbrella route", () => {
    expect(card(state(), "robin")).toEqual({
      state: "blue",
      labels: ["hiv"],
      route: "hiv",
      identity: { handle: "robin" },
    });
  });

  it("undetectable is indistinguishable from PrEP (same umbrella)", () => {
    const c = card(
      state({ onPrep: false, hiv: "positive_undetectable" }),
      "robin",
    );
    expect(c.labels).toEqual(["hiv"]);
    expect(c.route).toBe("hiv");
  });

  it("blue via public condoms-always: condom label + condom route", () => {
    expect(
      card(
        state({
          onPrep: false,
          condomPreference: "condoms_always",
          condomPreferencePublic: true,
        }),
        "sam",
      ),
    ).toEqual({
      state: "blue",
      labels: ["condoms_always"],
      route: "condoms_always",
      identity: { handle: "sam" },
    });
  });

  it("umbrella wins the headline when both routes are present", () => {
    const c = card(
      state({
        condomPreference: "condoms_always",
        condomPreferencePublic: true,
      }),
      "robin",
    );
    expect(c.labels).toEqual(["hiv", "condoms_always"]);
    expect(c.route).toBe("hiv"); // never re-headlined by condom use
  });

  it("a non-public condom preference shows no condom label", () => {
    const c = card(
      state({
        onPrep: false,
        condomPreference: "condoms_always",
        condomPreferencePublic: false,
      }),
      "sam",
    );
    expect(c.state).toBe("gray"); // no qualifying public route
    expect(c.labels).toEqual([]);
    expect(c.route).toBeNull();
  });

  it("a public non-always condom preference shows as a flat label, not a route", () => {
    const c = card(
      state({ condomPreference: "either", condomPreferencePublic: true }),
      "robin",
    );
    expect(c.labels).toEqual(["hiv", "condoms_either"]); // blue via umbrella
    expect(c.route).toBe("hiv");
  });

  it("labels still show on gray; only the headline route is gated on blue", () => {
    const gray = card(
      state({ testing: { ...tested, lastPanelDay: daysAgo(200) } }),
      "robin",
    );
    expect(gray.state).toBe("gray");
    expect(gray.labels).toEqual(["hiv"]); // attribute shows regardless of color
    expect(gray.route).toBeNull();
  });

  it("pause forces gray but keeps labels", () => {
    const c = card(state({ paused: true }), "robin");
    expect(c.state).toBe("gray");
    expect(c.labels).toEqual(["hiv"]);
    expect(c.route).toBeNull();
  });

  it("detectable HIV forces gray even with condoms-always", () => {
    const c = card(
      state({
        onPrep: false,
        hiv: "positive_detectable",
        condomPreference: "condoms_always",
        condomPreferencePublic: true,
      }),
      "robin",
    );
    expect(c.state).toBe("gray");
    expect(c.labels).toEqual(["condoms_always"]);
    expect(c.route).toBeNull();
  });

  it("doxy-PEP shows as a flat label, never a route, and never affects the badge", () => {
    // On a gray owner with no route, doxy-PEP still shows (labels are gated by
    // sharing, not color) and does not earn blue.
    const gray = card(state({ onPrep: false, onDoxyPep: true }), "robin");
    expect(gray.state).toBe("gray");
    expect(gray.labels).toEqual(["doxy_pep"]);
    expect(gray.route).toBeNull();

    // Alongside the umbrella it is an extra flat label; the route is unchanged.
    const blue = card(state({ onDoxyPep: true }), "robin");
    expect(blue.state).toBe("blue");
    expect(blue.labels).toEqual(["hiv", "doxy_pep"]);
    expect(blue.route).toBe("hiv");
  });
});

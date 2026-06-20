import { describe, it, expect } from "vitest";
import { deriveOwnerCard } from "./ownerCard.ts";
import type { OwnerState } from "../core/badge.ts";

const tested = {
  hasEverTested: true,
  lastPanelAgeDays: 10,
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

describe("deriveOwnerCard", () => {
  it("blue via PrEP: umbrella label + umbrella route", () => {
    expect(deriveOwnerCard(state(), "robin")).toEqual({
      state: "blue",
      labels: ["hiv"],
      route: "hiv",
      identity: { handle: "robin" },
    });
  });

  it("undetectable is indistinguishable from PrEP (same umbrella)", () => {
    const card = deriveOwnerCard(
      state({ onPrep: false, hiv: "positive_undetectable" }),
      "robin",
    );
    expect(card.labels).toEqual(["hiv"]);
    expect(card.route).toBe("hiv");
  });

  it("blue via public condoms-always: condom label + condom route", () => {
    const card = deriveOwnerCard(
      state({
        onPrep: false,
        condomPreference: "condoms_always",
        condomPreferencePublic: true,
      }),
      "sam",
    );
    expect(card).toEqual({
      state: "blue",
      labels: ["condoms_always"],
      route: "condoms_always",
      identity: { handle: "sam" },
    });
  });

  it("umbrella wins the headline when both routes are present", () => {
    const card = deriveOwnerCard(
      state({
        condomPreference: "condoms_always",
        condomPreferencePublic: true,
      }),
      "robin",
    );
    expect(card.labels).toEqual(["hiv", "condoms_always"]);
    expect(card.route).toBe("hiv"); // never re-headlined by condom use
  });

  it("a non-public condom preference shows no condom label", () => {
    const card = deriveOwnerCard(
      state({
        onPrep: false,
        condomPreference: "condoms_always",
        condomPreferencePublic: false,
      }),
      "sam",
    );
    expect(card.state).toBe("gray"); // no qualifying public route
    expect(card.labels).toEqual([]);
    expect(card.route).toBeNull();
  });

  it("a public non-always condom preference shows as a flat label, not a route", () => {
    const card = deriveOwnerCard(
      state({ condomPreference: "either", condomPreferencePublic: true }),
      "robin",
    );
    expect(card.labels).toEqual(["hiv", "condoms_either"]); // blue via umbrella
    expect(card.route).toBe("hiv");
  });

  it("labels still show on gray; only the headline route is gated on blue", () => {
    const gray = deriveOwnerCard(
      state({ testing: { ...tested, lastPanelAgeDays: 200 } }),
      "robin",
    );
    expect(gray.state).toBe("gray");
    expect(gray.labels).toEqual(["hiv"]); // attribute shows regardless of color
    expect(gray.route).toBeNull();
  });

  it("pause forces gray but keeps labels", () => {
    const card = deriveOwnerCard(state({ paused: true }), "robin");
    expect(card.state).toBe("gray");
    expect(card.labels).toEqual(["hiv"]);
    expect(card.route).toBeNull();
  });

  it("detectable HIV forces gray even with condoms-always", () => {
    const card = deriveOwnerCard(
      state({
        onPrep: false,
        hiv: "positive_detectable",
        condomPreference: "condoms_always",
        condomPreferencePublic: true,
      }),
      "robin",
    );
    expect(card.state).toBe("gray");
    expect(card.labels).toEqual(["condoms_always"]);
    expect(card.route).toBeNull();
  });

  it("doxy-PEP shows as a flat label, never a route, and never affects the badge", () => {
    // On a gray owner with no route, doxy-PEP still shows (labels are gated by
    // sharing, not color) and does not earn blue.
    const gray = deriveOwnerCard(
      state({ onPrep: false, onDoxyPep: true }),
      "robin",
    );
    expect(gray.state).toBe("gray");
    expect(gray.labels).toEqual(["doxy_pep"]);
    expect(gray.route).toBeNull();

    // Alongside the umbrella it is an extra flat label; the route is unchanged.
    const blue = deriveOwnerCard(state({ onDoxyPep: true }), "robin");
    expect(blue.state).toBe("blue");
    expect(blue.labels).toEqual(["hiv", "doxy_pep"]);
    expect(blue.route).toBe("hiv");
  });
});

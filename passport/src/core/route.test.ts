import { describe, it, expect } from "vitest";
import { withPrep, withCondomRoute } from "./route.ts";
import {
  INITIAL_OWNER_STATE,
  condomRoutePresent,
  type OwnerState,
} from "./badge.ts";

describe("withPrep", () => {
  it("sets the PrEP flag both ways and touches nothing else", () => {
    const on = withPrep(INITIAL_OWNER_STATE, true);
    expect(on.onPrep).toBe(true);
    expect(withPrep(on, false).onPrep).toBe(false);
    expect({ ...withPrep(on, false), onPrep: false }).toEqual(
      INITIAL_OWNER_STATE,
    );
  });
});

describe("withCondomRoute", () => {
  it("on makes condoms-always the public route", () => {
    const s = withCondomRoute(INITIAL_OWNER_STATE, true);
    expect(s.condomPreference).toBe("condoms_always");
    expect(s.condomPreferencePublic).toBe(true);
    expect(condomRoutePresent(s)).toBe(true);
  });

  it("off only hides it, preserving any other recorded preference", () => {
    const raw: OwnerState = {
      ...INITIAL_OWNER_STATE,
      condomPreference: "raw",
      condomPreferencePublic: true,
    };
    const off = withCondomRoute(raw, false);
    expect(off.condomPreference).toBe("raw"); // not rewritten
    expect(off.condomPreferencePublic).toBe(false);
    expect(condomRoutePresent(off)).toBe(false);
  });
});

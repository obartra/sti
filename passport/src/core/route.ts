/**
 * Owner-state updaters for the two HIV-protection routes a person sets directly
 * (the third, undetectable HIV, comes from a test result, not a toggle). These
 * are the writes behind the route controls in both Privacy/Settings and the
 * report flow, kept here as small pure functions so the two surfaces share one
 * definition and a viewer-facing route can't be set two subtly different ways.
 */

import type { OwnerState } from "./badge.ts";

/** Set whether the owner is on PrEP (the umbrella route, shared with undetectable). */
export function withPrep(s: OwnerState, on: boolean): OwnerState {
  return { ...s, onPrep: on };
}

/**
 * Turn the public condoms-always route on or off. On sets the preference to
 * condoms-always and shows it publicly (the only condom value that is also a
 * route). Off only stops showing it publicly, leaving any other recorded condom
 * preference intact, so toggling the route never silently rewrites a "no
 * condoms" / "condoms optional" choice the owner made elsewhere.
 */
export function withCondomRoute(s: OwnerState, on: boolean): OwnerState {
  if (on) {
    return {
      ...s,
      condomPreference: "condoms_always",
      condomPreferencePublic: true,
    };
  }
  return { ...s, condomPreferencePublic: false };
}

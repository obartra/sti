/**
 * Derive the public card (ResolvedView) an owner publishes from their private
 * inputs (OwnerState). This is the bridge from the trust-critical badge core to
 * the viewer-facing card, so it follows docs/03-design.md §1-3 exactly:
 *
 * - the badge state comes from {@link computeBadge} (the canonical blue/gray);
 * - PrEP and undetectable surface ONLY as one identical umbrella label "hiv"
 *   ("On HIV prevention"), never distinguished (HARD INVARIANT);
 * - the 3-state condom preference shows publicly only when the owner opts in,
 *   and only "condoms always" is also a route to blue;
 * - the umbrella always wins the headline route, so a PrEP/U=U person's condom
 *   use never changes the headline (it would leak method);
 * - labels show on gray too (gated by sharing, not badge color), so they are
 *   computed regardless of state; only the headline route is gated on blue.
 */

import {
  computeBadge,
  umbrellaRoutePresent,
  type OwnerState,
  type CondomPreference,
} from "../core/badge.ts";
import type { ProtectionLabel, Route } from "../ui/badge-card.tsx";
import type { ResolvedView } from "../ui/public/PublicResolution.tsx";
import type { ApiClient } from "../api/client.ts";
import type { AliasRecord } from "./accountBlob.ts";
import { republishCard } from "./publish.ts";

// The condom preferences that have a public label ("none" shows nothing).
const CONDOM_LABEL: Record<
  Exclude<CondomPreference, "none">,
  ProtectionLabel
> = {
  condoms_always: "condoms_always",
  either: "condoms_either",
  raw: "condoms_raw",
};

export function deriveOwnerCard(
  state: OwnerState,
  handle: string,
): ResolvedView {
  const badge = computeBadge(state);

  const labels: ProtectionLabel[] = [];
  if (umbrellaRoutePresent(state)) labels.push("hiv");
  if (state.condomPreferencePublic && state.condomPreference !== "none") {
    labels.push(CONDOM_LABEL[state.condomPreference]);
  }

  // The headline route exists only on blue; the umbrella wins so condom use
  // never re-headlines a PrEP/U=U person.
  let route: Route = null;
  if (badge === "blue") {
    route = umbrellaRoutePresent(state) ? "hiv" : "condoms_always";
  }

  return { state: badge, labels, route, identity: { handle } };
}

/**
 * Republish every one of the owner's aliases with their current derived card, so
 * a badge change (a new test result, a pause, a revoked condom commitment)
 * propagates to all shared links at once.
 */
export async function republishOwnerCard(
  api: ApiClient,
  records: readonly AliasRecord[],
  state: OwnerState,
  handle: string,
): Promise<void> {
  const card = deriveOwnerCard(state, handle);
  await Promise.all(records.map((r) => republishCard(api, r, card)));
}

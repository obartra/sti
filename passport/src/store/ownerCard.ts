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
import { avatarSrc, pseudonymFor, type AvatarConfig } from "../lib/avatars.ts";
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
  nowDay: number,
  avatar?: AvatarConfig,
): ResolvedView {
  const badge = computeBadge(state, nowDay);

  const labels: ProtectionLabel[] = [];
  if (umbrellaRoutePresent(state)) labels.push("hiv");
  if (state.condomPreferencePublic && state.condomPreference !== "none") {
    labels.push(CONDOM_LABEL[state.condomPreference]);
  }
  // doxy-PEP is a self-declared flat attribute (never a route): shown when set.
  if (state.onDoxyPep) labels.push("doxy_pep");

  // The headline route exists only on blue; the umbrella wins so condom use
  // never re-headlines a PrEP/U=U person.
  let route: Route = null;
  if (badge === "blue") {
    route = umbrellaRoutePresent(state) ? "hiv" : "condoms_always";
  }

  // Carry the owner's avatar (config + its rendered src) so a viewer sees the look
  // the owner built, not a handle-derived stand-in. Symmetric with parsePublicCard,
  // so a published card round-trips to exactly this view.
  const avatarFields = avatar ? { avatar, avatarSrc: avatarSrc(avatar) } : {};
  return { state: badge, labels, route, identity: { handle }, ...avatarFields };
}

/**
 * Republish every one of the owner's aliases with their current derived card, so
 * a badge change (a new test result, a pause, a revoked condom commitment)
 * propagates to all shared links.
 *
 * KNOWN DECORRELATION GAP: republishing all aliases in one window from the
 * owner's device lets the edge correlate those opaque ids as one owner's sibling
 * aliases, against the behavioural-unlinkability goal (docs/03-design §Privacy).
 * The locked fix is server-mediated, jittered/batched fan-out with cross-user
 * timing (docs/10 §F), the same deferred decorrelation work as the notify
 * cover-wake; it is gated off / not built. Tracked in doc 11.
 */
/**
 * The display identity a card shows for `record` (doc 15): its per-alias override
 * if the owner set one, else the deterministic id-derived default (a pseudonym
 * handle, and no avatar so the viewer falls back to the id-derived avatar). The
 * default reveals nothing because the id is random per alias.
 */
export function resolveCardIdentity(record: AliasRecord): {
  handle: string;
  avatar?: AvatarConfig;
} {
  return {
    handle: record.handle ?? pseudonymFor(record.id),
    ...(record.avatar ? { avatar: record.avatar } : {}),
  };
}

/**
 * Build the card published to one alias: the owner's badge (account-level, shared
 * across all their links) plus that alias's own resolved display identity.
 */
export function deriveAliasCard(
  state: OwnerState,
  record: AliasRecord,
  nowDay: number,
): ResolvedView {
  const id = resolveCardIdentity(record);
  return deriveOwnerCard(state, id.handle, nowDay, id.avatar);
}

/** The account-level inputs the owner's cards are derived from; the per-alias
 * identity comes from each record (see deriveAliasCard). */
export interface OwnerCardInputs {
  readonly state: OwnerState;
  readonly nowDay: number;
}

export async function republishOwnerCard(
  api: ApiClient,
  records: readonly AliasRecord[],
  owner: OwnerCardInputs,
): Promise<void> {
  await Promise.all(
    records.map((r) =>
      republishCard(api, r, deriveAliasCard(owner.state, r, owner.nowDay)),
    ),
  );
}

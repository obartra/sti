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
import { republishCard, sealCardPayload } from "./publish.ts";

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

/**
 * The owner's choice of displayed identity for an alias being minted (doc 15):
 * `anonymous` leaves the face id-derived (the unlinkable default), `main` shows the
 * account's main identity (its handle + avatar). A bespoke per-alias face is a
 * later opt-in; until then those are the two choices.
 */
export type AliasIdentity = "anonymous" | "main";

/**
 * Stamp the chosen display identity onto a freshly minted alias record. Pure and
 * deterministic, so applying it to the record passed to the card builder and to the
 * record that gets persisted yields the same override (the card and the stored
 * record can never disagree). `anonymous` returns the record unchanged.
 *
 * The face is per link (doc 15): `main` shows the account's identity by default, but
 * a caller can pass an `avatar` override so a revealed link can wear a different face
 * than the account default. That is what keeps two revealed links from being tied
 * together by an identical face. Absent, the account avatar is the default.
 */
export function withIdentity(
  record: AliasRecord,
  identity: AliasIdentity,
  account: { readonly handle?: string; readonly avatar: AvatarConfig },
): AliasRecord {
  if (identity === "main") {
    return {
      ...record,
      ...(account.handle !== undefined ? { handle: account.handle } : {}),
      avatar: account.avatar,
    };
  }
  return record;
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
  // One alias (or none) has no sibling to correlate with, so publish it immediately
  // rather than deferring the owner's status update for no privacy gain.
  if (records.length <= 1) {
    await Promise.all(
      records.map((r) =>
        republishCard(api, r, deriveAliasCard(owner.state, r, owner.nowDay)),
      ),
    );
    return;
  }
  // Two or more: hand the whole set to the server as one batch, which applies each
  // alias write at an independent jittered time, so an observer watching two of the
  // owner's cards does not see them change in the same instant (decorrelation,
  // doc 11). The trade is that the badge update lands within the server's window
  // rather than instantly; the partner-notify ping (if any) is a separate, immediate
  // path, so the time-sensitive signal is not delayed.
  const ops = await Promise.all(
    records.map(async (r) => ({
      id: r.id,
      ciphertext: await sealCardPayload(
        r,
        deriveAliasCard(owner.state, r, owner.nowDay),
      ),
      writeToken: r.writeToken,
    })),
  );
  await api.republish(ops);
}

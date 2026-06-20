/**
 * Derive the owner-facing view model from their account blob. This is the bridge
 * from the synced account state to what the in-app screens render (home, share,
 * settings), the owner-side counterpart of {@link deriveOwnerCard} (which derives
 * the viewer-facing public card).
 *
 * The badge, labels, and headline route reuse deriveOwnerCard exactly, so the
 * owner's own view can never disagree with what a viewer resolves. The remaining
 * fields are owner-only context (freshness, pause reason, sharing default) that
 * never reach a viewer.
 */

import {
  TESTING_WINDOW_DAYS,
  panelAgeDays,
  type TestingInput,
} from "../core/badge.ts";
import type { AvatarConfig } from "../lib/avatars.ts";
import type { BadgeState, ProtectionLabel, Route } from "../ui/badge-card.tsx";
import type { AccountBlob, SharingMode } from "./accountBlob.ts";
import { deriveOwnerCard } from "./ownerCard.ts";

/** The owner-facing view: badge plus owner-only context, never sent to a viewer. */
export interface OwnerView {
  readonly handle: string;
  readonly avatar: AvatarConfig;
  readonly badge: BadgeState;
  readonly viewerBadge: BadgeState;
  readonly labels: ProtectionLabel[];
  readonly blueRoute: Route;
  readonly sharingMode: SharingMode;
  /** Manually paused (forces gray). */
  readonly paused: boolean;
  /** Tested once, but the freshness window has lapsed (an automatic gray). */
  readonly autoPaused: boolean;
  /** Days remaining in the 90-day freshness window (0 when untested or lapsed). */
  readonly daysLeft: number;
  readonly lastTestedLabel: string;
}

function lastTestedLabel(t: TestingInput, nowDay: number): string {
  const age = panelAgeDays(t, nowDay);
  if (age === null) return "Never tested";
  if (age <= 0) return "Today";
  if (age === 1) return "Yesterday";
  return `${age} days ago`;
}

export function deriveOwnerView(blob: AccountBlob, nowDay: number): OwnerView {
  const card = deriveOwnerCard(blob.state, blob.handle, nowDay);
  const t = blob.state.testing;
  const age = panelAgeDays(t, nowDay);
  const lapsed = age !== null && age > TESTING_WINDOW_DAYS;

  return {
    handle: blob.handle,
    avatar: blob.avatar,
    badge: card.state,
    // The owner views their own badge; there is no separate viewer here.
    viewerBadge: card.state,
    labels: card.labels ?? [],
    blueRoute: card.route ?? null,
    sharingMode: blob.sharingMode,
    paused: blob.state.paused,
    autoPaused: lapsed,
    daysLeft: age !== null ? Math.max(0, TESTING_WINDOW_DAYS - age) : 0,
    lastTestedLabel: lastTestedLabel(t, nowDay),
  };
}

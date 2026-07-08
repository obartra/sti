/**
 * The in-person linkup codec (doc 25). Two people who are physically together
 * connect in one shared gesture: each phone shows an OFFER and scans the other's.
 * An offer is an ordinary contact invite (doc 13 path A, so the whole capability
 * exchange reuses that codec) plus a compact badge snapshot in the fragment, so
 * status is shown at the moment of connecting even with no signal (decision 2 of
 * doc 25). The snapshot crosses optically between two people standing together,
 * which is what makes it trustworthy; it is only honored same-day.
 *
 * parseScannedConnect classifies whatever a camera decoded: an offer (complete my
 * pending side of the gesture), or a plain/keyed alias link (view it, exactly what
 * scanning did before the gesture existed). Fail-closed like every codec here:
 * anything malformed is null, and a malformed snapshot never rejects the offer it
 * rides on (the link still connects, just without an offline badge).
 */

import type { BadgeState } from "../ui/badge-card.tsx";
import { parseAliasLink } from "./aliasLink.ts";
import { parseContactInvite, type ContactInvite } from "./contactInvite.ts";
import type { AliasLink } from "./passportStore.ts";

/** The badge asserted at the moment of connecting: a color and the day it held. */
export interface BadgeSnapshot {
  readonly badge: BadgeState;
  readonly day: number;
}

/** Append the badge snapshot to an offer (contact-invite) URL, in the fragment. */
export function offerUrlWithBadge(
  inviteUrl: string,
  snapshot: BadgeSnapshot,
): string {
  return `${inviteUrl}&b=${snapshot.badge}.${snapshot.day}`;
}

// Strictly parse a `b=` fragment value; anything else fails closed to null.
const SNAPSHOT = /^(blue|gray)\.(\d{1,7})$/;

function parseBadgeSnapshot(hash: string): BadgeSnapshot | null {
  const b = new URLSearchParams(hash.replace(/^#/, "")).get("b");
  const m = b !== null ? SNAPSHOT.exec(b) : null;
  const badge = m?.[1];
  const day = m?.[2];
  if (badge === undefined || day === undefined) return null;
  return { badge: badge as BadgeState, day: Number(day) };
}

/**
 * The snapshot's badge if it is still current, else null. A snapshot is honored
 * only on the day it was asserted: the two people are standing together right
 * now, so a replayed or stale code never shows an old blue.
 */
export function freshSnapshotBadge(
  snapshot: BadgeSnapshot | null,
  nowDay: number,
): BadgeState | null {
  return snapshot !== null && snapshot.day === nowDay ? snapshot.badge : null;
}

/** What a scanned code turned out to be: an in-person offer, or a viewable link. */
export type ScannedConnect =
  | {
      readonly kind: "offer";
      readonly invite: ContactInvite;
      readonly snapshot: BadgeSnapshot | null;
    }
  | { readonly kind: "link"; readonly link: AliasLink };

/**
 * Classify the text decoded from a scanned QR. A contact invite with no `ref` is
 * an in-person offer (a RETURN invite is someone answering a remote link, not an
 * offer, so it falls through to the view flow its alias link supports). Anything
 * that is neither an offer nor a well-formed alias link is null, and the caller
 * keeps scanning. Pure and total; a scanned code is untrusted input throughout.
 */
export function parseScannedConnect(text: string): ScannedConnect | null {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    return null;
  }
  const invite = parseContactInvite(url.pathname, url.hash);
  if (invite !== null && invite.ref === undefined) {
    return { kind: "offer", invite, snapshot: parseBadgeSnapshot(url.hash) };
  }
  const link = parseAliasLink(url.pathname, url.hash);
  return link === null ? null : { kind: "link", link };
}

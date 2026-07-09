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
import { bytesToUtf8, utf8ToBytes, type Bytes } from "../crypto/index.ts";
import { validId } from "../api/contract.ts";
import {
  parseContactInvite,
  parseScannedCode,
  type ContactInvite,
  type ScannedCode,
} from "./contactInvite.ts";
import type { InboxCapability } from "./notifyInbox.ts";

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

// The door code an open completion screen shows (doc 25 "the door stays open"):
// an opaque knock pointer and nothing else. No key, no capability, so a
// photographed door code grants nothing; it is only somewhere to knock, and it
// goes dead when the holder closes the screen.
const DOOR_PATH = /^\/d\/?$/;
const DOOR_ORIGIN = "https://sti.care";

/** Build the door URL an open completion screen renders as its QR. */
export function doorUrl(pointerId: string): string {
  return `${DOOR_ORIGIN}/d#p=${pointerId}`;
}

/** What a scanned code turned out to be: an in-person offer, an open door to
 * knock at, or any other passport code, which routes exactly like OPENING the
 * same link (the {@link ScannedCode} contract). */
export type ScannedConnect =
  | {
      readonly kind: "offer";
      readonly invite: ContactInvite;
      readonly snapshot: BadgeSnapshot;
    }
  | { readonly kind: "door"; readonly pointerId: string }
  | { readonly kind: "code"; readonly code: ScannedCode };

/**
 * Classify the text decoded from a scanned QR. The badge snapshot is the offer
 * DISCRIMINATOR: only the in-person connect screen mints codes carrying one, so
 * an invite with a well-formed `b=` is an offer (this side completes silently),
 * while an invite without one is a remote link someone printed or messaged and
 * routes exactly like opening it (the accept flow, so its sender still gets a
 * return and never silently half-links). Anything else that is a well-formed
 * passport code routes the same open-the-link way; junk is null and the caller
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
  const snapshot = parseBadgeSnapshot(url.hash);
  if (invite !== null && invite.ref === undefined && snapshot !== null) {
    return { kind: "offer", invite, snapshot };
  }
  if (DOOR_PATH.test(url.pathname)) {
    const p = new URLSearchParams(url.hash.replace(/^#/, "")).get("p");
    return p !== null && validId(p) ? { kind: "door", pointerId: p } : null;
  }
  const code = parseScannedCode(text);
  return code === null ? null : { kind: "code", code };
}

/**
 * What a door holder seals to an arrival (doc 25): a fresh contact invite (the
 * same fields the offer QR carries, minted fresh for this one person) plus a
 * fresh one-shot RETURN inbox the joiner answers through. The return channel
 * rides inside the ECIES-sealed grant, so no bearer code ever carries its write
 * token and nothing here is readable by anyone but this pair.
 */
export interface DoorGrant {
  readonly invite: ContactInvite;
  readonly returnInbox: InboxCapability;
}

// An inbox capability's shape (three id-shaped tokens); local copy, mirroring
// the other codecs, so this file does not reach into private validators.
function isInboxShape(x: unknown): x is InboxCapability {
  if (typeof x !== "object" || x === null) return false;
  const r = x as Record<string, unknown>;
  return [r.inboxId, r.writeToken, r.key].every(
    (f) => typeof f === "string" && validId(f),
  );
}

function isNotifyShape(x: unknown): x is ContactInvite["notify"] {
  if (!isInboxShape(x)) return false;
  const r = x as unknown as Record<string, unknown>;
  return typeof r.routingToken === "string" && validId(r.routingToken);
}

/** Encode a door grant to the plaintext bytes sealGroupJoinGrant seals. */
export function encodeDoorGrant(grant: DoorGrant): Bytes {
  return utf8ToBytes(
    JSON.stringify({
      alias: grant.invite.alias,
      notify: grant.invite.notify,
      ...(grant.invite.sharedName !== undefined
        ? { sharedName: grant.invite.sharedName }
        : {}),
      returnInbox: grant.returnInbox,
    }),
  );
}

// The alias read caps a grant carries: two id-shaped tokens, or null.
function parseAliasCaps(x: unknown): { id: string; key: string } | null {
  if (typeof x !== "object" || x === null) return null;
  const r = x as Record<string, unknown>;
  if (typeof r.id !== "string" || !validId(r.id)) return null;
  if (typeof r.key !== "string" || !validId(r.key)) return null;
  return { id: r.id, key: r.key };
}

/**
 * Parse a redeemed door grant, or null on any surprise (a decoy that opened to
 * garbage, a wrong key, a bad shape). Fails CLOSED like every codec here: a
 * payload that is not a well-formed grant is "no grant for me", never acted on.
 */
export function parseDoorGrant(bytes: Bytes): DoorGrant | null {
  try {
    const o: unknown = JSON.parse(bytesToUtf8(bytes));
    if (typeof o !== "object" || o === null) return null;
    const r = o as Record<string, unknown>;
    const alias = parseAliasCaps(r.alias);
    if (alias === null) return null;
    if (!isNotifyShape(r.notify) || !isInboxShape(r.returnInbox)) return null;
    return {
      invite: {
        alias,
        notify: r.notify,
        ...(typeof r.sharedName === "string" && r.sharedName !== ""
          ? { sharedName: r.sharedName }
          : {}),
      },
      returnInbox: r.returnInbox,
    };
  } catch {
    return null;
  }
}

/** Encode the joiner's answer: its RETURN invite URL, written into the grant's
 * return inbox (sealed by the inbox layer; the URL never crosses in the clear). */
export function encodeDoorReturn(returnUrl: string): Bytes {
  return utf8ToBytes(returnUrl);
}

/**
 * Parse a door-return payload back into the return invite it carries, or null
 * on any surprise. Requires `ref` (a return names the alias it answers), so a
 * stray offer or garbage written into the inbox is never ingested.
 */
export function parseDoorReturn(bytes: Bytes): ContactInvite | null {
  let url: URL;
  try {
    url = new URL(bytesToUtf8(bytes).trim());
  } catch {
    return null;
  }
  const ret = parseContactInvite(url.pathname, url.hash);
  return ret?.ref !== undefined ? ret : null;
}

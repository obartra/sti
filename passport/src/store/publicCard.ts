/**
 * The wire schema for a published passport card: what an owner seals into an
 * alias payload and a viewer decrypts and renders. JSON inside the encrypted
 * block, versioned so an unknown shape is rejected rather than mis-rendered.
 *
 * Parsing is strict and fails closed: any structural surprise throws, and the
 * store maps that to the uniform `null` resolution (the gray card), exactly like
 * a decrypt failure or a miss. So a corrupt or adversarial payload can never
 * render as a real status.
 */

import type { BadgeState, ProtectionLabel, Route } from "../ui/badge-card.tsx";
import type { ResolvedView } from "../ui/public/PublicResolution.tsx";
import { utf8ToBytes, type Bytes } from "../crypto/index.ts";
import {
  avatarSrc,
  isAvatarConfig,
  type AvatarConfig,
} from "../lib/avatars.ts";
import { decodeVersionedUpTo, isValidHandle } from "./codec.ts";

// We SERIALIZE at the latest version; we PARSE any version up to it. v1 cards
// (already published to prod before avatars) have no avatar and stay valid; the
// only difference at v2 is the optional avatar, so the older shape parses cleanly.
const SCHEMA_VERSION = 2;

const BADGE_STATES: readonly BadgeState[] = ["blue", "gray"];
const PROTECTION_LABELS: readonly ProtectionLabel[] = [
  "hiv",
  "condoms_always",
  "condoms_either",
  "condoms_raw",
];

interface PublishedCardV2 {
  readonly v: typeof SCHEMA_VERSION;
  readonly state: BadgeState;
  readonly labels: ProtectionLabel[];
  readonly route: Route;
  readonly handle: string;
  // v2+. The owner's avatar config (one per account today). The card is sealed, so
  // carrying it leaks nothing to the blind server; it just lets a viewer see the
  // look the owner built instead of a handle-derived stand-in. A viewer holding two
  // of an owner's links can correlate them by avatar, the same as they already
  // could by handle, so this adds no correlation surface (doc 13 limits). Omitted
  // when the owner never set one.
  readonly avatar?: AvatarConfig;
}

function isBadgeState(x: unknown): x is BadgeState {
  return (
    typeof x === "string" && (BADGE_STATES as readonly string[]).includes(x)
  );
}

function isLabel(x: unknown): x is ProtectionLabel {
  return (
    typeof x === "string" &&
    (PROTECTION_LABELS as readonly string[]).includes(x)
  );
}

/** Serialize a resolved card into the versioned wire bytes (owner side). */
export function serializePublicCard(card: ResolvedView): Bytes {
  const wire: PublishedCardV2 = {
    v: SCHEMA_VERSION,
    state: card.state,
    labels: card.labels ?? [],
    route: card.route ?? null,
    handle: card.identity.handle,
    // Omit entirely when absent so a no-avatar card is byte-clean (and a v1-shaped
    // card is still produced for an owner who never built an avatar).
    ...(card.avatar ? { avatar: card.avatar } : {}),
  };
  return utf8ToBytes(JSON.stringify(wire));
}

/**
 * Parse decrypted bytes into a ResolvedView, validating every field. Throws on
 * anything unexpected so the caller can fail closed to the uniform null state.
 */
export function parsePublicCard(bytes: Bytes): ResolvedView {
  const o = decodeVersionedUpTo(bytes, SCHEMA_VERSION);
  if (!isBadgeState(o.state)) {
    throw new Error("public card: invalid state");
  }
  if (!isValidHandle(o.handle)) {
    throw new Error("public card: invalid handle");
  }
  if (!Array.isArray(o.labels) || !o.labels.every(isLabel)) {
    throw new Error("public card: invalid labels");
  }
  if (o.route !== null && !isLabel(o.route)) {
    throw new Error("public card: invalid route");
  }
  // The avatar is optional (absent in v1). When present it must be a well-formed
  // config; a malformed one fails closed like any other bad field.
  if (o.avatar !== undefined && !isAvatarConfig(o.avatar)) {
    throw new Error("public card: invalid avatar");
  }
  return {
    state: o.state,
    labels: o.labels,
    route: o.route,
    identity: { handle: o.handle },
    // Reconstruct the rendered src from OUR template (never from the wire), so a
    // card can't smuggle in arbitrary SVG. Symmetric with deriveOwnerCard.
    ...(o.avatar !== undefined
      ? { avatar: o.avatar, avatarSrc: avatarSrc(o.avatar) }
      : {}),
  };
}

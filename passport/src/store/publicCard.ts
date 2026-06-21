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
import { decodeVersioned, isValidHandle } from "./codec.ts";

// One wire schema, parsed by exact version: a payload whose `v` is not this
// version fails closed. v2 is the only shape we accept; v1 (the pre-avatar shape,
// already published to the live store) is intentionally no longer parsed, so a
// stale v1 link resolves to gray until the owner's next edit republishes it. We
// keep the number at 2 (not reset to 1) so it stays monotonic with what is in the
// wild and a version number never denotes two different shapes.
const SCHEMA_VERSION = 2;

const BADGE_STATES: readonly BadgeState[] = ["blue", "gray"];
// Keyed by the union so a new ProtectionLabel fails to compile here until it is
// added, keeping this validator in lockstep with what deriveOwnerCard can emit.
// (They drifted once: doxy_pep was emitted but not accepted, so any card carrying
// it failed closed to gray for every viewer.)
const PROTECTION_LABELS: Record<ProtectionLabel, true> = {
  hiv: true,
  condoms_always: true,
  condoms_either: true,
  condoms_raw: true,
  doxy_pep: true,
};

interface PublishedCard {
  readonly v: typeof SCHEMA_VERSION;
  readonly state: BadgeState;
  readonly labels: ProtectionLabel[];
  readonly route: Route;
  readonly handle: string;
  // The owner's avatar config (one per account today). The card is sealed, so
  // carrying it leaks nothing to the blind server; it just lets a viewer see the
  // look the owner built instead of a handle-derived stand-in. Being one value per
  // account, the avatar (like the account-wide handle) lets a viewer holding two of
  // an owner's links correlate them: a real cross-alias correlation surface, interim
  // until per-alias identity (doc 15) makes the face unlinkable by default. Optional:
  // a card with no avatar resolves to a handle-derived stand-in.
  readonly avatar?: AvatarConfig;
}

function isBadgeState(x: unknown): x is BadgeState {
  return (
    typeof x === "string" && (BADGE_STATES as readonly string[]).includes(x)
  );
}

function isLabel(x: unknown): x is ProtectionLabel {
  // Own-key check so inherited keys like "toString" never pass as labels.
  return (
    typeof x === "string" &&
    Object.prototype.hasOwnProperty.call(PROTECTION_LABELS, x)
  );
}

/** Serialize a resolved card into the versioned wire bytes (owner side). */
export function serializePublicCard(card: ResolvedView): Bytes {
  const wire: PublishedCard = {
    v: SCHEMA_VERSION,
    state: card.state,
    labels: card.labels ?? [],
    route: card.route ?? null,
    handle: card.identity.handle,
    // Omit entirely when absent so a no-avatar card is byte-clean.
    ...(card.avatar ? { avatar: card.avatar } : {}),
  };
  return utf8ToBytes(JSON.stringify(wire));
}

/**
 * Parse decrypted bytes into a ResolvedView, validating every field. Throws on
 * anything unexpected so the caller can fail closed to the uniform null state.
 */
export function parsePublicCard(bytes: Bytes): ResolvedView {
  const o = decodeVersioned(bytes, SCHEMA_VERSION);
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
  // The avatar is optional. When present it must be a well-formed config; a
  // malformed one fails closed like any other bad field.
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

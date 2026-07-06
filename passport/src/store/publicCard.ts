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
// version fails closed. v3 is the only shape we accept; earlier shapes (v1
// pre-avatar, v2 pre-freshness) are intentionally no longer parsed, so a stale
// older link resolves to gray until the owner's next edit or app-open republishes
// it. The number stays monotonic with what is in the wild, so a version never
// denotes two different shapes.
const SCHEMA_VERSION = 3;

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
  // The card's display avatar. The card is sealed, so carrying it leaks nothing to
  // the blind server; it just lets a viewer see a face instead of a stand-in. Per
  // doc 15 this is the alias's OWN per-alias identity (id-derived and unlinkable by
  // default; the account face is stamped only on the owner's explicit "main" opt-in),
  // so the avatar is no longer a cross-alias correlation surface. Optional: a card
  // with no avatar resolves to a handle-derived stand-in.
  readonly avatar?: AvatarConfig;
  // The epoch day a BLUE card's freshness lapses (last panel + the testing window).
  // Present only on blue cards. It rides inside the sealed block, so it is invisible
  // to the blind server; a viewer reads it to fail a stale blue closed to gray
  // (applyFreshness). It is never rendered, so no "expires on" date is shown.
  readonly freshUntil?: number;
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
    // Carry the freshness deadline only on blue (the only card that can go
    // stale-blue); a gray card is already fail-closed, so it needs none.
    ...(card.state === "blue" && card.freshUntil !== undefined
      ? { freshUntil: card.freshUntil }
      : {}),
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
  // The avatar is optional and cosmetic. A missing, old-shape, or corrupt avatar
  // is not an error: the card just falls back to the id-derived stand-in (doc 19).
  return {
    state: o.state,
    labels: o.labels,
    route: o.route,
    identity: { handle: o.handle },
    // Reconstruct the rendered src from OUR template (never from the wire), so a
    // card can't smuggle in arbitrary SVG. Symmetric with deriveOwnerCard.
    ...(isAvatarConfig(o.avatar)
      ? { avatar: o.avatar, avatarSrc: avatarSrc(o.avatar) }
      : {}),
    // Carry the freshness deadline through when present and well-formed on a blue
    // card; anything else is simply absent (a blue card with no deadline is treated
    // as already-stale by applyFreshness, so a malformed value fails safe to gray).
    ...(o.state === "blue" && isEpochDay(o.freshUntil)
      ? { freshUntil: o.freshUntil }
      : {}),
  };
}

/** A non-negative integer epoch day. */
function isEpochDay(x: unknown): x is number {
  return typeof x === "number" && Number.isInteger(x) && x >= 0;
}

/**
 * Fail a stale BLUE card closed to gray at read time (doc 02 "never stale-blue").
 * A blue card is valid only while `today <= freshUntil`; past that (or if a blue
 * card carries no deadline at all, e.g. an older wire shape) it collapses to the
 * card's gray form: state gray, the blue-only headline route dropped, identity and
 * attribute labels kept (labels show on gray too), so it renders like any other
 * gray. Null passes through (the uniform gray-nothing). Gray cards are unchanged.
 */
export function applyFreshness(
  view: ResolvedView | null,
  nowDay: number,
): ResolvedView | null {
  if (view?.state !== "blue") return view;
  if (view.freshUntil !== undefined && nowDay <= view.freshUntil) return view;
  // Stale (or a blue card carrying no deadline): fail closed to the gray form. Drop
  // the blue-only route and the deadline; keep identity + labels so it reads like a
  // natively-gray card of the same person.
  return {
    state: "gray",
    route: null,
    identity: view.identity,
    ...(view.labels ? { labels: view.labels } : {}),
    ...(view.avatar ? { avatar: view.avatar, avatarSrc: view.avatarSrc } : {}),
  };
}

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
import { decodeVersioned, isValidHandle } from "./codec.ts";

const SCHEMA_VERSION = 1;

const BADGE_STATES: readonly BadgeState[] = ["blue", "gray"];
const PROTECTION_LABELS: readonly ProtectionLabel[] = [
  "hiv",
  "condoms_always",
  "condoms_either",
  "condoms_raw",
];

interface PublishedCardV1 {
  readonly v: typeof SCHEMA_VERSION;
  readonly state: BadgeState;
  readonly labels: ProtectionLabel[];
  readonly route: Route;
  readonly handle: string;
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
  const wire: PublishedCardV1 = {
    v: SCHEMA_VERSION,
    state: card.state,
    labels: card.labels ?? [],
    route: card.route ?? null,
    handle: card.identity.handle,
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
  return {
    state: o.state,
    labels: o.labels,
    route: o.route,
    identity: { handle: o.handle },
  };
}

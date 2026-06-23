/**
 * The owner's encrypted device state, synced across their devices via the
 * key-derived account id (GET/PUT /acct). Unlike an alias payload it is not
 * existence-sensitive (the account id is private and key-derived), so it is
 * variable-length, not padded.
 *
 * Versioned JSON inside the encrypted blob; parsing is strict and fails closed,
 * so a corrupt blob is treated as "no usable account" rather than mis-restored.
 *
 * This first version carries the owner's identity and the aliases they have
 * published, each with the capabilities a fresh device needs to manage them (the
 * read id, the write token, and the decryption key). Badge inputs and circles
 * are added in later slices; the version guards that growth.
 */

import { utf8ToBytes, type Bytes } from "../crypto/index.ts";
import { validId } from "../api/contract.ts";
import { isOwnerState, type OwnerState } from "../core/badge.ts";
import {
  isAvatarConfig,
  migrateAvatar,
  type AvatarConfig,
} from "../lib/avatars.ts";
import { decodeVersioned, isValidHandle } from "./codec.ts";
import type { NotifyCapability } from "./notifyInbox.ts";

// v9 adds the optional per-alias display override (`handle` + `avatar` on
// AliasRecord, doc 15): a card's face is derived deterministically from the alias
// id by default, and these override it when the owner opts into a recognizable
// look. v8 added `theirStatusAlias` per contact (doc 13 path A): the contact's own
// alias that I READ to see their status, captured when a mutual link exchange
// completes. Read-only ({id,key}, no write token), distinct from `alias` (the alias
// I publish for them). Optional until the exchange completes. v7 added `circles`;
// v6 added the pairwise notify capabilities (`myNotify` + `theirNotify`); v5 added
// the per-contact links (`contacts`); v4 was the absolute-day testing input. There
// are no real older accounts in the wild, so the current version is parsed
// exclusively: an older or otherwise malformed blob fails the strict version check
// and parseAccountBlob THROWS (recovery surfaces an error rather than silently
// restoring it). Only a genuine account miss (404) maps to null/"no account".
const SCHEMA_VERSION = 10;

/** A published alias and the capabilities to manage it from any device. */
export interface AliasRecord {
  readonly id: string;
  readonly writeToken: string;
  readonly key: string;
  readonly isPublic: boolean;
  /**
   * Optional per-alias display override (doc 15). Absent means the card's face is
   * derived deterministically from `id` (an unlinkable default); set means the
   * owner opted this alias into a recognizable look. These are display values, not
   * addresses: never unique, never in the URL.
   */
  readonly handle?: string;
  readonly avatar?: AvatarConfig;
  /**
   * Optional link lifetime (doc 16): the epoch day this link expires, or null /
   * absent for until-revoked. Enforced client-side, the device stops republishing
   * and sweeps the link once expired, the same model as a contact link's expiry.
   */
  readonly expiresDay?: number | null;
}

/**
 * A read-only handle on someone else's alias: the id to fetch and the key to open
 * it, with no write token (I can read their status, not overwrite it). This is the
 * contact's own `myAlias` as seen from my side after a mutual exchange.
 */
export interface StatusAlias {
  readonly id: string;
  readonly key: string;
}

/** A private nickname is the owner's own label; never sent, capped to keep blobs small. */
export const MAX_CONTACT_LABEL = 64;

/**
 * A per-contact link: a private alias the owner published for one person, with a
 * local nickname and an expiry. Individually revocable, so dropping one contact
 * never touches another (the per-token/no-global-access model, doc 02/13).
 */
export interface ContactRecord {
  /** A local opaque id for the pairing (stable across alias rotation). */
  readonly id: string;
  /** The owner's private nickname for this contact; may be empty. Never sent. */
  readonly label: string;
  /** Epoch day the link was created. */
  readonly createdDay: number;
  /** Epoch day the link expires, or null for until-revoked. */
  readonly expiresDay: number | null;
  /** The private alias this contact resolves; always isPublic=false. */
  readonly alias: AliasRecord;
  /**
   * The contact's notify capability, received when the link exchange completed.
   * Present only once exchanged; absent means this contact cannot yet be notified.
   */
  readonly theirNotify?: NotifyCapability;
  /**
   * The contact's own alias that I read to see THEIR status (read-only, no write
   * token). Present only once a mutual exchange completed; absent means I have
   * shared my status with them but cannot yet see theirs.
   */
  readonly theirStatusAlias?: StatusAlias;
}

/** A circle name is the owner's own label for a bundle; never sent, capped small. */
export const MAX_CIRCLE_NAME = 64;

/**
 * A circle (doc 13 slice 6): a purely client-side bundle of contacts the owner
 * groups together, with a name. The server never learns a circle exists; group
 * status sharing reuses each member's existing pairwise channel. Membership is a
 * list of ContactRecord ids.
 */
export interface CircleRecord {
  /** A local opaque id for the circle. */
  readonly id: string;
  /** The owner's private name for the circle; may be empty. Never sent. */
  readonly name: string;
  /** The contacts in this circle, by their ContactRecord id. */
  readonly memberContactIds: string[];
}

/** The account-level sharing default: a public profile, or link-only (private). */
export type SharingMode = "public" | "link";

export function isSharingMode(x: unknown): x is SharingMode {
  return x === "public" || x === "link";
}

export interface AccountBlob {
  readonly handle: string;
  readonly aliases: AliasRecord[];
  /** Private, individually-revocable links, one per contact the owner shared with. */
  readonly contacts: ContactRecord[];
  /** The owner's private badge inputs, from which the public card is derived. */
  readonly state: OwnerState;
  /** The owner's chosen avatar (rendered in-app and on shared cards). */
  readonly avatar: AvatarConfig;
  /** The account-level sharing default chosen at onboarding. */
  readonly sharingMode: SharingMode;
  /**
   * The owner's own notify capability: their inbox (where contacts write pings) and
   * routing token (how a wake reaches them). Minted once at signup and stable.
   * Optional so pre-v6 construction sites stay valid; minted lazily where needed.
   */
  readonly myNotify?: NotifyCapability;
  /**
   * Client-side contact bundles (doc 13 slice 6). Optional so pre-v7 construction
   * sites stay valid; absent means no circles. Never sent to the server.
   */
  readonly circles?: CircleRecord[];
}

interface AccountBlobWire extends AccountBlob {
  readonly v: typeof SCHEMA_VERSION;
}

// The optional per-alias display override (doc 15). Handle and expiry still fail
// closed; the avatar is exempt because it is cosmetic and migrates (doc 19): a bad
// or old-shape override avatar is dropped on read by migrateAliasOverride below, so
// it must not invalidate the whole alias here.
function hasValidAliasOverride(r: Record<string, unknown>): boolean {
  return (
    (r.handle === undefined || isValidHandle(r.handle)) &&
    (r.expiresDay === undefined || isDayOrNull(r.expiresDay))
  );
}

// Drop an alias override avatar that is not a valid current config (old-shape or
// corrupt), so the alias keeps its handle/expiry and falls back to the id-derived
// avatar. Cosmetic-only, lossy on purpose (doc 19).
function migrateAliasOverride(a: AliasRecord): AliasRecord {
  if (a.avatar === undefined || isAvatarConfig(a.avatar)) return a;
  // Rebuild without the cosmetic override avatar (keep in sync with AliasRecord).
  return {
    id: a.id,
    writeToken: a.writeToken,
    key: a.key,
    isPublic: a.isPublic,
    ...(a.handle !== undefined ? { handle: a.handle } : {}),
    ...(a.expiresDay !== undefined ? { expiresDay: a.expiresDay } : {}),
  };
}

function isAliasRecord(x: unknown): x is AliasRecord {
  if (typeof x !== "object" || x === null) return false;
  const r = x as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    validId(r.id) &&
    typeof r.writeToken === "string" &&
    validId(r.writeToken) &&
    typeof r.key === "string" &&
    validId(r.key) &&
    typeof r.isPublic === "boolean" &&
    hasValidAliasOverride(r)
  );
}

function isDayOrNull(x: unknown): boolean {
  return x === null || (typeof x === "number" && Number.isInteger(x) && x >= 0);
}

// A notify capability is four base64url tokens (inbox id, write token, key, and
// routing token), each id-shaped. Used for both myNotify and a contact's theirNotify.
function isNotifyCapability(x: unknown): x is NotifyCapability {
  if (typeof x !== "object" || x === null) return false;
  const r = x as Record<string, unknown>;
  return (
    typeof r.inboxId === "string" &&
    validId(r.inboxId) &&
    typeof r.writeToken === "string" &&
    validId(r.writeToken) &&
    typeof r.key === "string" &&
    validId(r.key) &&
    typeof r.routingToken === "string" &&
    validId(r.routingToken)
  );
}

// A notify capability is optional on a contact (absent until the link exchange).
function isOptionalNotify(x: unknown): boolean {
  return x === undefined || isNotifyCapability(x);
}

function isStatusAlias(x: unknown): x is StatusAlias {
  if (typeof x !== "object" || x === null) return false;
  const r = x as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    validId(r.id) &&
    typeof r.key === "string" &&
    validId(r.key)
  );
}

// A read-only status alias is optional on a contact (absent until I can see theirs).
function isOptionalStatusAlias(x: unknown): boolean {
  return x === undefined || isStatusAlias(x);
}

// The alias plus the two optional exchange capabilities on a contact.
function hasValidContactAliases(r: Record<string, unknown>): boolean {
  return (
    isAliasRecord(r.alias) &&
    isOptionalNotify(r.theirNotify) &&
    isOptionalStatusAlias(r.theirStatusAlias)
  );
}

function isContactRecord(x: unknown): x is ContactRecord {
  if (typeof x !== "object" || x === null) return false;
  const r = x as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    validId(r.id) &&
    typeof r.label === "string" &&
    r.label.length <= MAX_CONTACT_LABEL &&
    typeof r.createdDay === "number" &&
    Number.isInteger(r.createdDay) &&
    r.createdDay >= 0 &&
    isDayOrNull(r.expiresDay) &&
    hasValidContactAliases(r)
  );
}

function isCircleRecord(x: unknown): x is CircleRecord {
  if (typeof x !== "object" || x === null) return false;
  const r = x as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    validId(r.id) &&
    typeof r.name === "string" &&
    r.name.length <= MAX_CIRCLE_NAME &&
    Array.isArray(r.memberContactIds) &&
    r.memberContactIds.every((m) => typeof m === "string" && validId(m))
  );
}

// circles is optional on the account (absent until the owner makes one).
function isOptionalCircles(x: unknown): boolean {
  return x === undefined || (Array.isArray(x) && x.every(isCircleRecord));
}

export function serializeAccountBlob(blob: AccountBlob): Bytes {
  // theirNotify rides inside each contact; myNotify and circles are omitted when
  // absent, so a contact-only account stays byte-identical plus the version bump.
  const wire: AccountBlobWire = {
    v: SCHEMA_VERSION,
    handle: blob.handle,
    aliases: blob.aliases,
    contacts: blob.contacts,
    state: blob.state,
    avatar: blob.avatar,
    sharingMode: blob.sharingMode,
    ...(blob.myNotify !== undefined ? { myNotify: blob.myNotify } : {}),
    ...(blob.circles !== undefined ? { circles: blob.circles } : {}),
  };
  return utf8ToBytes(JSON.stringify(wire));
}

// Validate every field strictly, throwing on the first problem. Kept separate so
// parseAccountBlob stays a thin decode-validate-return.
function assertValidBlob(o: Record<string, unknown>): void {
  if (!isValidHandle(o.handle)) {
    throw new Error("account blob: invalid handle");
  }
  if (!Array.isArray(o.aliases) || !o.aliases.every(isAliasRecord)) {
    throw new Error("account blob: invalid aliases");
  }
  if (!Array.isArray(o.contacts) || !o.contacts.every(isContactRecord)) {
    throw new Error("account blob: invalid contacts");
  }
  if (!isOwnerState(o.state)) {
    throw new Error("account blob: invalid state");
  }
  // The avatar is not gated here: it is cosmetic and migrates to the default on
  // read (see parseAccountBlob), so an old-shape or corrupt avatar must not brick
  // the whole account (doc 19).
  if (!isSharingMode(o.sharingMode)) {
    throw new Error("account blob: invalid sharingMode");
  }
  assertValidOptionalFields(o);
}

// The fields added in v6/v7, each optional (absent on a pre-feature account).
function assertValidOptionalFields(o: Record<string, unknown>): void {
  if (!isOptionalNotify(o.myNotify)) {
    throw new Error("account blob: invalid myNotify");
  }
  if (!isOptionalCircles(o.circles)) {
    throw new Error("account blob: invalid circles");
  }
}

/** Parse decrypted bytes into an AccountBlob, validating strictly (throws). */
export function parseAccountBlob(bytes: Bytes): AccountBlob {
  const o = decodeVersioned(bytes, SCHEMA_VERSION);
  assertValidBlob(o);
  return {
    handle: o.handle as string,
    aliases: (o.aliases as AliasRecord[]).map(migrateAliasOverride),
    contacts: o.contacts as AccountBlob["contacts"],
    state: o.state as AccountBlob["state"],
    avatar: migrateAvatar(o.avatar),
    sharingMode: o.sharingMode as AccountBlob["sharingMode"],
    ...(isNotifyCapability(o.myNotify) ? { myNotify: o.myNotify } : {}),
    ...(Array.isArray(o.circles)
      ? { circles: o.circles as CircleRecord[] }
      : {}),
  };
}

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
import { isAvatarConfig, type AvatarConfig } from "../lib/avatars.ts";
import { decodeVersioned, isValidHandle } from "./codec.ts";
import type { NotifyCapability } from "./notifyInbox.ts";

// v6 adds the pairwise notify capabilities (doc 13 slice 5): the account's own
// `myNotify` (minted at signup; how contacts wake/notify the owner) and an optional
// `theirNotify` per contact (the contact's capability, received at link exchange).
// Both are optional so existing construction sites and a pre-exchange contact stay
// valid. v5 added the per-contact links (`contacts`); v4 was the absolute-day
// testing input. There are no real older accounts in the wild, so the current
// version is parsed exclusively: an older or otherwise malformed blob fails the
// strict version check and parseAccountBlob THROWS (recovery surfaces an error
// rather than silently restoring it). Only a genuine account miss (404) maps to
// null/"no account".
const SCHEMA_VERSION = 6;

/** A published alias and the capabilities to manage it from any device. */
export interface AliasRecord {
  readonly id: string;
  readonly writeToken: string;
  readonly key: string;
  readonly isPublic: boolean;
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
}

interface AccountBlobV6 extends AccountBlob {
  readonly v: typeof SCHEMA_VERSION;
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
    typeof r.isPublic === "boolean"
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
    isAliasRecord(r.alias) &&
    isOptionalNotify(r.theirNotify)
  );
}

export function serializeAccountBlob(blob: AccountBlob): Bytes {
  // theirNotify rides inside each contact and myNotify is omitted when absent, so a
  // pre-exchange account stays byte-identical to its v5 shape plus the version bump.
  const wire: AccountBlobV6 = {
    v: SCHEMA_VERSION,
    handle: blob.handle,
    aliases: blob.aliases,
    contacts: blob.contacts,
    state: blob.state,
    avatar: blob.avatar,
    sharingMode: blob.sharingMode,
    ...(blob.myNotify !== undefined ? { myNotify: blob.myNotify } : {}),
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
  if (!isAvatarConfig(o.avatar)) {
    throw new Error("account blob: invalid avatar");
  }
  if (!isSharingMode(o.sharingMode)) {
    throw new Error("account blob: invalid sharingMode");
  }
  if (!isOptionalNotify(o.myNotify)) {
    throw new Error("account blob: invalid myNotify");
  }
}

/** Parse decrypted bytes into an AccountBlob, validating strictly (throws). */
export function parseAccountBlob(bytes: Bytes): AccountBlob {
  const o = decodeVersioned(bytes, SCHEMA_VERSION);
  assertValidBlob(o);
  return {
    handle: o.handle as string,
    aliases: o.aliases as AccountBlob["aliases"],
    contacts: o.contacts as AccountBlob["contacts"],
    state: o.state as AccountBlob["state"],
    avatar: o.avatar as AccountBlob["avatar"],
    sharingMode: o.sharingMode as AccountBlob["sharingMode"],
    ...(isNotifyCapability(o.myNotify) ? { myNotify: o.myNotify } : {}),
  };
}

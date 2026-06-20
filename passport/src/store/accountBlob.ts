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

// v5 adds the per-contact links (`contacts`): a private, individually-revocable
// link per person the owner has shared with (doc 13). v4 was the absolute-day
// testing input. There are no real older accounts in the wild, so the current
// version is parsed exclusively: an older or otherwise malformed blob fails the
// strict version check and parseAccountBlob THROWS (recovery surfaces an error
// rather than silently restoring it). Only a genuine account miss (404) maps to
// null/"no account".
const SCHEMA_VERSION = 5;

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
}

interface AccountBlobV5 extends AccountBlob {
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
    isAliasRecord(r.alias)
  );
}

export function serializeAccountBlob(blob: AccountBlob): Bytes {
  const wire: AccountBlobV5 = {
    v: SCHEMA_VERSION,
    handle: blob.handle,
    aliases: blob.aliases,
    contacts: blob.contacts,
    state: blob.state,
    avatar: blob.avatar,
    sharingMode: blob.sharingMode,
  };
  return utf8ToBytes(JSON.stringify(wire));
}

/** Parse decrypted bytes into an AccountBlob, validating strictly (throws). */
export function parseAccountBlob(bytes: Bytes): AccountBlob {
  const o = decodeVersioned(bytes, SCHEMA_VERSION);
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
  return {
    handle: o.handle,
    aliases: o.aliases,
    contacts: o.contacts,
    state: o.state,
    avatar: o.avatar,
    sharingMode: o.sharingMode,
  };
}

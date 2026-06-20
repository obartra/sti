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

// v3 adds the owner's presentation profile (avatar + sharing default) so a fresh
// device restores the full owner-facing view, not just the badge inputs. There
// are no real v2 accounts in the wild, so v3 is parsed exclusively: an older or
// otherwise malformed blob fails the strict version check and parseAccountBlob
// THROWS (recovery surfaces an error rather than silently restoring it). Only a
// genuine account miss (404) maps to null/"no account".
const SCHEMA_VERSION = 3;

/** A published alias and the capabilities to manage it from any device. */
export interface AliasRecord {
  readonly id: string;
  readonly writeToken: string;
  readonly key: string;
  readonly isPublic: boolean;
}

/** The account-level sharing default: a public profile, or link-only (private). */
export type SharingMode = "public" | "link";

export function isSharingMode(x: unknown): x is SharingMode {
  return x === "public" || x === "link";
}

export interface AccountBlob {
  readonly handle: string;
  readonly aliases: AliasRecord[];
  /** The owner's private badge inputs, from which the public card is derived. */
  readonly state: OwnerState;
  /** The owner's chosen avatar (rendered in-app and on shared cards). */
  readonly avatar: AvatarConfig;
  /** The account-level sharing default chosen at onboarding. */
  readonly sharingMode: SharingMode;
}

interface AccountBlobV3 extends AccountBlob {
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

export function serializeAccountBlob(blob: AccountBlob): Bytes {
  const wire: AccountBlobV3 = {
    v: SCHEMA_VERSION,
    handle: blob.handle,
    aliases: blob.aliases,
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
    state: o.state,
    avatar: o.avatar,
    sharingMode: o.sharingMode,
  };
}

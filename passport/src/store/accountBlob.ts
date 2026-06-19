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

import { utf8ToBytes, bytesToUtf8, type Bytes } from "../crypto/index.ts";

const SCHEMA_VERSION = 1;
const MAX_HANDLE_LEN = 64;
const ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** A published alias and the capabilities to manage it from any device. */
export interface AliasRecord {
  readonly id: string;
  readonly writeToken: string;
  readonly key: string;
  readonly isPublic: boolean;
}

export interface AccountBlob {
  readonly handle: string;
  readonly aliases: AliasRecord[];
}

interface AccountBlobV1 extends AccountBlob {
  readonly v: typeof SCHEMA_VERSION;
}

function isAliasRecord(x: unknown): x is AliasRecord {
  if (typeof x !== "object" || x === null) return false;
  const r = x as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    ID_PATTERN.test(r.id) &&
    typeof r.writeToken === "string" &&
    ID_PATTERN.test(r.writeToken) &&
    typeof r.key === "string" &&
    ID_PATTERN.test(r.key) &&
    typeof r.isPublic === "boolean"
  );
}

export function serializeAccountBlob(blob: AccountBlob): Bytes {
  const wire: AccountBlobV1 = {
    v: SCHEMA_VERSION,
    handle: blob.handle,
    aliases: blob.aliases,
  };
  return utf8ToBytes(JSON.stringify(wire));
}

/** Parse decrypted bytes into an AccountBlob, validating strictly (throws). */
export function parseAccountBlob(bytes: Bytes): AccountBlob {
  const raw: unknown = JSON.parse(bytesToUtf8(bytes));
  if (typeof raw !== "object" || raw === null) {
    throw new Error("account blob: not an object");
  }
  const o = raw as Record<string, unknown>;
  if (o.v !== SCHEMA_VERSION) {
    throw new Error(`account blob: unsupported version ${String(o.v)}`);
  }
  if (
    typeof o.handle !== "string" ||
    o.handle.length === 0 ||
    o.handle.length > MAX_HANDLE_LEN
  ) {
    throw new Error("account blob: invalid handle");
  }
  if (!Array.isArray(o.aliases) || !o.aliases.every(isAliasRecord)) {
    throw new Error("account blob: invalid aliases");
  }
  return { handle: o.handle, aliases: o.aliases };
}

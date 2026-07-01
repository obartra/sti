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

import {
  utf8ToBytes,
  parseRecoveryPhrase,
  type Bytes,
} from "../crypto/index.ts";
import { validId } from "../api/contract.ts";
import { hasVanityNameShape } from "./vanityName.ts";
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
//
// v11 adds the optional `findable` registration (doc 17): the public vanity name
// the owner claimed plus the id of the dedicated alias it resolves to. Absent on a
// pre-Findable account, and whenever the owner currently has no name.
//
// v12 moves the notify inbox per contact (doc 13): the single account-level
// `myNotify` is gone; each contact carries the owner's own `myInbox` (the inbox
// THAT contact nudges the owner through), minted fresh per link. One shared inbox
// let a recipient with two of the owner's links correlate them to one owner; a
// per-contact inbox does not. There are no real older accounts, so the version is
// parsed exclusively and an older blob fails the strict check (see below).
//
// v13 adds the optional `recoveryName` (doc 32): the non-secret, owner-chosen
// locator that names the account's password-recovery envelope, so Settings can
// re-view it and turn the password off. Absent when no password factor is set. It
// is not a secret and never derived from the password (the account id still derives
// from the phrase only); it shares the vanity-name charset but is a separate
// namespace, shape-validated only.
//
// v14 adds the optional `recoveryPhrase` (doc 32): the account's own recovery
// phrase, stored inside this already-encrypted blob so the owner can re-view it from
// Settings. The phrase is the 256-bit root secret; keeping it here adds no new
// derivation power (opening the blob already needs the root the phrase derives), it
// only lets a root-holding session re-display it. It is written at sign-up and
// backfilled on the next phrase login for accounts created before this feature;
// absent on an account that has only ever resumed by passkey. Validated strictly to
// the app-phrase format so a malformed value fails the parse rather than surfacing a
// broken phrase. The blob never leaves the device unencrypted, so the phrase only
// ever lives inside the encrypted vault.
const SCHEMA_VERSION = 14;

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
   * Optional link lifetime (doc 16): the absolute epoch-ms instant this link
   * expires, or null / absent for until-revoked. Server-enforced (sent on the
   * alias PUT) AND swept by the device. Absolute ms so it can be sub-day.
   */
  readonly expiresAt?: number | null;
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
  /** Absolute epoch-ms instant the link expires, or null for until-revoked (doc 16). */
  readonly expiresAt: number | null;
  /** The private alias this contact resolves; always isPublic=false. */
  readonly alias: AliasRecord;
  /**
   * The owner's OWN receiving inbox dedicated to THIS contact (doc 13): minted
   * fresh per contact and handed only to them, so it is the capability this one
   * contact uses to nudge the owner. Per-contact (not one shared inbox) is what
   * stops a recipient who holds two of the owner's links from correlating them to a
   * single owner. The owner polls every contact's `myInbox` to receive nudges.
   */
  readonly myInbox?: NotifyCapability;
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

/**
 * The owner's public vanity-name registration (doc 17): the claimed `name` and the
 * id of the dedicated public alias it resolves to. The alias lives in the account's
 * `aliases` list (so knocks to it are reviewed) but is managed solely through the
 * Findable section, never the share sheet, so name and alias rotate together.
 */
export interface FindableRegistration {
  /** The claimed public name (canonical, lowercase). */
  readonly name: string;
  /** The id of the dedicated alias this name resolves to. */
  readonly aliasId: string;
}

/** The account-level sharing default: a public profile, or link-only (private). */
export type SharingMode = "public" | "link";

export function isSharingMode(x: unknown): x is SharingMode {
  return x === "public" || x === "link";
}

export interface AccountBlob {
  /** The owner's local display name, owner-facing only, never sent to the server. Optional. */
  readonly handle?: string;
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
   * Which face the Home hero opens on: "criteria" (the owner-only breakdown,
   * the default) or "shared" (what a viewer resolves). Owner-facing UI preference
   * only; optional so pre-feature accounts stay valid (absent means "criteria").
   */
  readonly homeDefaultView?: "criteria" | "shared";
  /**
   * Client-side contact bundles (doc 13 slice 6). Optional so pre-v7 construction
   * sites stay valid; absent means no circles. Never sent to the server.
   */
  readonly circles?: CircleRecord[];
  /**
   * The owner's public vanity-name registration (doc 17). Optional so pre-v11
   * construction sites stay valid; absent means no name is claimed. The referenced
   * alias is also present in `aliases`.
   */
  readonly findable?: FindableRegistration;
  /**
   * The recovery locator that names this account's password-recovery envelope (doc
   * 32): the non-secret, owner-chosen name the envelope is stored under. Absent when
   * no password factor is set. Shape-validated (vanity charset), never a secret, and
   * never derived from the password.
   */
  readonly recoveryName?: string;
  /**
   * The account's own recovery phrase (doc 32), stored inside this encrypted blob so
   * Settings can re-view it. It is the 43-char app-generated phrase and is validated
   * to that exact format on parse. Written at sign-up and backfilled on a phrase
   * login; absent on an account that has only resumed by passkey (the phrase is not
   * available there), in which case Settings shows a re-view-after-sign-in fallback.
   * Storing it adds no derivation power: opening this blob already needs the root the
   * phrase derives. It only ever lives inside the encrypted vault, never on the
   * server in plaintext, in logs, or in any unencrypted store.
   */
  readonly recoveryPhrase?: string;
}

interface AccountBlobWire extends Omit<AccountBlob, "handle"> {
  readonly v: typeof SCHEMA_VERSION;
  readonly handle?: string;
}

// The optional per-alias display override (doc 15). Handle and expiry still fail
// closed; the avatar is exempt because it is cosmetic and migrates (doc 19): a bad
// or old-shape override avatar is dropped on read by migrateAliasOverride below, so
// it must not invalidate the whole alias here.
function hasValidAliasOverride(r: Record<string, unknown>): boolean {
  return (
    (r.handle === undefined || isValidHandle(r.handle)) &&
    // The avatar is intentionally NOT validated here: it is cosmetic and migrates
    // (doc 19), so a bad/old-shape override avatar is dropped on read rather than
    // invalidating the alias. Handle and expiry still fail closed.
    (r.expiresAt === undefined || isMsOrNull(r.expiresAt))
  );
}

// Drop an alias override avatar that is not a valid current config (old-shape or
// corrupt), so the alias keeps every other field (handle, expiry, tokens) and just
// falls back to the id-derived avatar. Cosmetic-only, lossy on purpose (doc 19).
function migrateAliasOverride(a: AliasRecord): AliasRecord {
  if (a.avatar === undefined || isAvatarConfig(a.avatar)) return a;
  const copy = { ...a };
  delete (copy as { avatar?: AvatarConfig }).avatar;
  return copy;
}

// A per-contact link carries the owner's alias (it can hold an avatar override
// when the owner revealed themselves), so its avatar migrates the same way.
function migrateContactAvatar(c: ContactRecord): ContactRecord {
  const alias = migrateAliasOverride(c.alias);
  return alias === c.alias ? c : { ...c, alias };
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

// A non-negative integer (an epoch-ms instant) or null (no expiry). The same
// shape works for any absolute time value; named for its use, link expiry.
function isMsOrNull(x: unknown): boolean {
  return x === null || (typeof x === "number" && Number.isInteger(x) && x >= 0);
}

// A notify capability is four base64url tokens (inbox id, write token, key, and
// routing token), each id-shaped. Used for a contact's myInbox and theirNotify.
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

// The alias plus the optional exchange capabilities on a contact: the owner's own
// per-contact inbox, the contact's notify capability, and the read-only status alias.
function hasValidContactAliases(r: Record<string, unknown>): boolean {
  return (
    isAliasRecord(r.alias) &&
    isOptionalNotify(r.myInbox) &&
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
    (r.expiresAt === undefined || isMsOrNull(r.expiresAt)) &&
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

// A findable registration: a well-SHAPED name (charset only, not the mutable
// reserved/blocked sets, so a later blocklist growth never bricks a stored name)
// plus an id-shaped alias id. Optional on the account (absent until the owner
// claims a name).
function isFindableRegistration(x: unknown): x is FindableRegistration {
  if (typeof x !== "object" || x === null) return false;
  const r = x as Record<string, unknown>;
  return (
    hasVanityNameShape(r.name) &&
    typeof r.aliasId === "string" &&
    validId(r.aliasId)
  );
}

function isOptionalFindable(x: unknown): boolean {
  return x === undefined || isFindableRegistration(x);
}

// The recovery locator (doc 32): shape-only, since it names a private envelope, not
// a public directory entry, so the mutable reserved/blocked sets never apply. Absent
// when no password factor is set.
function isOptionalRecoveryName(x: unknown): boolean {
  return x === undefined || hasVanityNameShape(x);
}

// The stored recovery phrase (doc 32): absent, or an exact app-phrase (the 43-char
// base64url format parseRecoveryPhrase validates). A malformed value fails the parse
// rather than surfacing a broken phrase in Settings.
function isOptionalRecoveryPhrase(x: unknown): boolean {
  return (
    x === undefined ||
    (typeof x === "string" && parseRecoveryPhrase(x) !== null)
  );
}

export function serializeAccountBlob(blob: AccountBlob): Bytes {
  // myInbox and theirNotify ride inside each contact; circles/findable are omitted
  // when absent, so a contact-only account stays compact.
  const wire: AccountBlobWire = {
    v: SCHEMA_VERSION,
    ...(blob.handle !== undefined ? { handle: blob.handle } : {}),
    aliases: blob.aliases,
    contacts: blob.contacts,
    state: blob.state,
    avatar: blob.avatar,
    sharingMode: blob.sharingMode,
    ...(blob.homeDefaultView !== undefined
      ? { homeDefaultView: blob.homeDefaultView }
      : {}),
    ...(blob.circles !== undefined ? { circles: blob.circles } : {}),
    ...(blob.findable !== undefined ? { findable: blob.findable } : {}),
    ...(blob.recoveryName !== undefined
      ? { recoveryName: blob.recoveryName }
      : {}),
    ...(blob.recoveryPhrase !== undefined
      ? { recoveryPhrase: blob.recoveryPhrase }
      : {}),
  };
  return utf8ToBytes(JSON.stringify(wire));
}

// Validate every field strictly, throwing on the first problem. Kept separate so
// parseAccountBlob stays a thin decode-validate-return.
function assertValidBlob(o: Record<string, unknown>): void {
  if (o.handle !== undefined && !isValidHandle(o.handle)) {
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

// The optional account-level fields (absent on a pre-feature account). The notify
// inboxes now live per contact (myInbox), validated inside isContactRecord.
function assertValidOptionalFields(o: Record<string, unknown>): void {
  if (!isOptionalCircles(o.circles)) {
    throw new Error("account blob: invalid circles");
  }
  if (!isOptionalFindable(o.findable)) {
    throw new Error("account blob: invalid findable");
  }
  if (!isOptionalRecoveryName(o.recoveryName)) {
    throw new Error("account blob: invalid recoveryName");
  }
  if (!isOptionalRecoveryPhrase(o.recoveryPhrase)) {
    throw new Error("account blob: invalid recoveryPhrase");
  }
  if (!isOptionalHomeDefaultView(o.homeDefaultView)) {
    throw new Error("account blob: invalid homeDefaultView");
  }
}

function isOptionalHomeDefaultView(x: unknown): boolean {
  return x === undefined || x === "criteria" || x === "shared";
}

/** Parse decrypted bytes into an AccountBlob, validating strictly (throws). */
export function parseAccountBlob(bytes: Bytes): AccountBlob {
  const o = decodeVersioned(bytes, SCHEMA_VERSION);
  assertValidBlob(o);
  return {
    ...(o.handle !== undefined ? { handle: o.handle as string } : {}),
    aliases: (o.aliases as AliasRecord[]).map(migrateAliasOverride),
    contacts: (o.contacts as ContactRecord[]).map(migrateContactAvatar),
    state: o.state as AccountBlob["state"],
    avatar: migrateAvatar(o.avatar),
    sharingMode: o.sharingMode as AccountBlob["sharingMode"],
    ...(o.homeDefaultView === "criteria" || o.homeDefaultView === "shared"
      ? { homeDefaultView: o.homeDefaultView }
      : {}),
    ...(Array.isArray(o.circles)
      ? { circles: o.circles as CircleRecord[] }
      : {}),
    ...(isFindableRegistration(o.findable) ? { findable: o.findable } : {}),
    ...(hasVanityNameShape(o.recoveryName)
      ? { recoveryName: o.recoveryName }
      : {}),
    ...(typeof o.recoveryPhrase === "string"
      ? { recoveryPhrase: o.recoveryPhrase }
      : {}),
  };
}

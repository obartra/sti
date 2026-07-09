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
import { migrateAvatar, type AvatarConfig } from "../lib/avatars.ts";
import {
  migrateAliasOverride,
  migrateContactAvatar,
  migrateGroupAvatar,
} from "./accountBlobAvatar.ts";
import { decodeVersioned, isValidHandle } from "./codec.ts";
import type { InboxCapability, NotifyCapability } from "./notifyInbox.ts";
import type { GroupVisibility, MeetingKind } from "./groupObject.ts";

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
//
// v15 adds the optional `passwordSetAt` (doc 32): the epoch-ms instant the recovery
// password was last set or changed. Recorded alongside `recoveryName` when the
// password is turned on or changed, and cleared when it is turned off. It lets the
// yearly "refresh your password" nudge track the real change date and sync it across
// devices, replacing the earlier device-local "present since first seen" mark (which
// did not sync). Absent when no password is set, and absent on an account that set
// its password before this field existed, in which case the nudge treats it as "not
// yet due" and never nags immediately. A non-secret timing value, never derived from
// the password.
//
// v16 adds the optional `groups` (doc 33): the shared groups the owner is in, each
// with the capabilities a device needs to read and (as admin) rewrite the group,
// including the shared group key `Kg` and the group blob's write token. Storing `Kg`
// and the write tokens here is consistent with how alias write tokens are already
// kept: the blob is encrypted at rest under the account key, so it is the same
// vault. Absent on a pre-groups account; the version guards the growth.
//
// v18 adds the member's optional shown face on their group card (`myHandle` +
// `myAvatar` on GroupRecord, doc 33 "show as you"): a group card is anonymous
// (id-derived) by default; a member who chose to appear as their main identity
// snapshots their account handle + avatar here (not read live, so a later edit does
// not change what the group already sees, doc 15). Both optional, so a pre-v18
// record stays valid and anonymous.
//
// v17 grows the group record for the membership lifecycle (doc 33, slice 4a).
// `groupWriteToken` and `kg` become OPTIONAL: only an admin holds the write token
// (they rewrite the blob) and mints `Kg` at create, so a member's record has
// neither at first and caches `Kg` only once the admin has added their slot and a
// roster poll unwraps it. An admin record still requires both (enforced in
// isGroupRecord). A member carries the admin<->member `lifecycleInbox` (the channel
// their accept/leave rides); an admin carries the roster `members` (each member's
// card id, their member key so `Kg` can be re-wrapped in the rotation slice, and
// their lifecycle inbox) and the `pendingInvites` not yet accepted. All the new
// fields are optional, so a pre-v17 account (admin-only groups from slice 3) stays
// valid and simply has none of them.
// v19 turns the single optional `findable` into a `findables` LIST (doc 17): the
// owner can claim up to MAX_PUBLIC_NAMES public names, each backed by its own
// dedicated public alias. The server already allows this (one name per alias, and an
// account holds unlimited aliases); v19 only lifts the client's one-per-account
// structural cap. No migration path: there are no real accounts in the wild yet, so a
// pre-v19 blob fails the strict version check exactly like any older version.
//
// v20 drops the account-level `sharingMode` field (doc 16): public sharing is now
// exclusively the findable `/u/` handle and private sharing the keyed `/a/` link, so
// there is no account-wide public/private default to store. No migration path: there
// are no real accounts in the wild yet, so a pre-v20 blob fails the strict version
// check exactly like any older version.
//
// v21 adds the optional member-side `joinedDay` on GroupRecord (doc 33): the epoch
// day the owner accepted a group invite, stamped at accept so the app can spot a
// join the admin never ingested (a raced or dead invite link) and quietly offer a
// fresh link once GROUP_JOIN_WAIT_DAYS have passed without the group opening. No
// migration path: there are no real accounts in the wild yet, so a pre-v21 blob
// fails the strict version check exactly like any older version.
const SCHEMA_VERSION = 21;

/**
 * The most public names one account may hold at once (doc 17). A client-side cap: the
 * server enforces only one name per alias, so this bounds how many dedicated public
 * aliases the account mints. The add control disables at this count.
 */
export const MAX_PUBLIC_NAMES = 5;

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
  /**
   * Epoch day the encounter happened, when it differs from `createdDay` (doc 25):
   * the owner can back-date a connection they logged after the fact, and the
   * partner-notify lookback seeds on this day, not on when the record was made.
   * Optional and backward-compatible: absent means "same as createdDay", so an
   * older blob reads unchanged and no version bump is needed. Read through
   * {@link encounterDayOf}, never directly, so the fallback is always applied.
   */
  readonly encounterDay?: number;
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

/**
 * One roster member as the admin holds it (doc 33, slice 4a): the opaque `cardId`
 * where they publish their group card, their `memberKey` (base64url) so `Kg` can be
 * re-wrapped to them on a key rotation (slice 5), and the `lifecycleInbox` (now the
 * leave channel for this member). Admin-only; a member never holds another member's
 * secrets. The member key is safe to keep here (the admin already holds `Kg`; HKDF
 * is one-way, so it grants no new power), inside the already-encrypted account vault.
 */
export interface GroupMemberSecret {
  readonly cardId: string;
  readonly memberKey: string;
  readonly lifecycleInbox: InboxCapability;
}

/**
 * An invite the admin has sent but that is not yet accepted (doc 33, slice 4a): a
 * local `inviteId`, the `lifecycleInbox` the admin minted for it (and polls for the
 * accept/reject), the `createdDay`, and an optional private `label` for the admin's
 * own reference. Admin-only. On accept it becomes a {@link GroupMemberSecret}; a
 * revoke or reject drops it.
 */
export interface PendingGroupInvite {
  readonly inviteId: string;
  readonly lifecycleInbox: InboxCapability;
  readonly createdDay: number;
  readonly label?: string;
}

/**
 * A shared group the owner is in (doc 33), with everything a device needs to read
 * it and, as admin, rewrite it. `kg` is the base64url of the shared group key `Kg`
 * (the capability that opens every member's card and the group core); `groupId` +
 * `groupWriteToken` address and gate the group blob; `myCardId` +
 * `myCardWriteToken` are where the owner publishes their own group card (sealed
 * under `Kg`). `joinPointerId` + `joinWriteToken` are the dedicated public-handle
 * join pointer, present only when the handle was actually claimed (a public group);
 * a later slice uses the pointer as the request inbox. `isAdmin` is true for the
 * creator (the sole admin in v1).
 *
 * `groupWriteToken` and `kg` are OPTIONAL (doc 33, slice 4a): only an admin holds
 * the write token, and a member gains `kg` only once the admin has added their slot
 * and a roster poll caches it, so both are absent on a fresh member record (an admin
 * record always carries them, enforced by isGroupRecord). A member also carries
 * `lifecycleInbox` (the admin<->member channel); an admin carries `members` (the
 * roster secrets) and `pendingInvites` (invites not yet accepted).
 */
export interface GroupRecord {
  readonly groupId: string;
  readonly groupWriteToken?: string;
  readonly kg?: string;
  readonly myCardId: string;
  readonly myCardWriteToken: string;
  readonly handle: string;
  readonly visibility: GroupVisibility;
  readonly meetingKind: MeetingKind;
  readonly isAdmin: boolean;
  /**
   * The member's OWN shown face on their group card (doc 33 "show as you"): absent
   * means anonymous (id-derived, the default), set means they chose their main
   * identity, snapshotted at create/accept (doc 15). Display values, never
   * addresses; the server never sees them (they ride inside the card sealed under
   * `Kg`). The avatar migrates on read like any stored avatar, so a bad/old-shape
   * one falls back to id-derived rather than bricking the record (doc 19).
   */
  readonly myHandle?: string;
  readonly myAvatar?: AvatarConfig;
  readonly joinPointerId?: string;
  readonly joinWriteToken?: string;
  /** Admin-only: the accepted roster, one secret per member. */
  readonly members?: GroupMemberSecret[];
  /** Admin-only: invites sent but not yet accepted. */
  readonly pendingInvites?: PendingGroupInvite[];
  /** Member-only: the admin<->member channel this member accepted through. */
  readonly lifecycleInbox?: InboxCapability;
  /**
   * Member-only: the epoch day the owner accepted the invite (doc 33). A join the
   * admin never ingests (a raced or dead invite link) leaves the record without
   * `kg` forever; this stamp is what lets the app notice and offer a fresh link
   * (joinStalled) instead of waiting silently.
   */
  readonly joinedDay?: number;
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
   * The owner's public vanity-name registrations (doc 17): up to MAX_PUBLIC_NAMES
   * claimed names, each with its own dedicated public alias (also present in
   * `aliases`). Optional and omitted when empty, so an account with no public name
   * stays compact. Names are unique (the server rejects a duplicate claim).
   */
  readonly findables?: FindableRegistration[];
  /**
   * The shared groups the owner is in (doc 33). Optional so pre-v16 construction
   * sites stay valid; absent means no groups. Each record holds the group key and
   * the write tokens, kept inside this already-encrypted blob (never sent to the
   * server except as opaque ciphertext).
   */
  readonly groups?: GroupRecord[];
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
  /**
   * When the recovery password was last set or changed (doc 32), as an epoch-ms
   * instant. Set alongside `recoveryName` when the password is turned on or changed;
   * cleared when it is turned off. The yearly password-refresh nudge reads this to
   * track the real change date across devices. Absent when no password is set, and
   * absent on an account whose password predates this field (the nudge then treats it
   * as not yet due). A non-secret timing value, never derived from the password.
   */
  readonly passwordSetAt?: number;
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

// An inbox capability is three id-shaped base64url tokens (inbox id, write token,
// key). Used for a group's lifecycle inbox (doc 33) and as the base of a notify
// capability. Kept here (not imported from groupInvite) so the codec's validators
// stay self-contained.
function isInboxCapability(x: unknown): x is InboxCapability {
  if (typeof x !== "object" || x === null) return false;
  const r = x as Record<string, unknown>;
  return isIdField(r.inboxId) && isIdField(r.writeToken) && isIdField(r.key);
}

// A notify capability is an inbox capability plus the id-shaped routing token used
// to wake the owner. Used for a contact's myInbox and theirNotify.
function isNotifyCapability(x: unknown): x is NotifyCapability {
  return (
    isInboxCapability(x) &&
    isIdField((x as unknown as Record<string, unknown>).routingToken)
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
    isEpochDay(r.createdDay) &&
    hasValidContactDates(r) &&
    hasValidContactAliases(r)
  );
}

/** A non-negative integer epoch day (the shape createdDay/encounterDay share). */
function isEpochDay(x: unknown): x is number {
  return typeof x === "number" && Number.isInteger(x) && x >= 0;
}

/** The optional dates on a contact: a back-dated encounter day and a link expiry,
 * each valid-or-absent. Split out to keep isContactRecord under the complexity cap. */
function hasValidContactDates(r: Record<string, unknown>): boolean {
  return (
    (r.encounterDay === undefined || isEpochDay(r.encounterDay)) &&
    (r.expiresAt === undefined || isMsOrNull(r.expiresAt))
  );
}

/**
 * The day an encounter happened for notify/display: the back-dated `encounterDay`
 * when set, else `createdDay`. The one place the optional field is resolved, so a
 * pre-encounterDay blob and a same-day link both read as their createdDay.
 */
export function encounterDayOf(c: ContactRecord): number {
  return c.encounterDay ?? c.createdDay;
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

// A list of findable registrations: an array of well-shaped entries. Length is NOT
// capped here: MAX_PUBLIC_NAMES is a claim-time rule (enforced at register + in the
// UI), not a storage invariant, so a rare offline multi-device merge that unions past
// the cap still parses and self-heals as the owner removes one.
function isFindablesArray(x: unknown): x is FindableRegistration[] {
  return Array.isArray(x) && x.every(isFindableRegistration);
}

function isOptionalFindables(x: unknown): boolean {
  return x === undefined || isFindablesArray(x);
}

// An id-shaped base64url token, or (when optional) absent.
function isIdField(x: unknown): x is string {
  return typeof x === "string" && validId(x);
}
function isOptionalIdField(x: unknown): boolean {
  return x === undefined || isIdField(x);
}

// The group's always-present capability ids: the blob id and the owner's own card
// id + write token (where they publish their group card). `groupWriteToken` and `kg`
// are role/lifecycle dependent (doc 33, slice 4a) so they are OPTIONAL here: an admin
// must hold both and a member holds neither at first, with the admin case enforced in
// isGroupRecord. `kg` is the base64url of the 32-byte group key, so a 43-char id shape.
function hasGroupCapabilities(r: Record<string, unknown>): boolean {
  return (
    isIdField(r.groupId) &&
    isIdField(r.myCardId) &&
    isIdField(r.myCardWriteToken) &&
    isOptionalIdField(r.kg) &&
    isOptionalIdField(r.groupWriteToken)
  );
}

// One roster member secret (doc 33, slice 4a): the card id, the member key
// (base64url, id-shaped), and the lifecycle inbox.
function isGroupMemberSecret(x: unknown): x is GroupMemberSecret {
  if (typeof x !== "object" || x === null) return false;
  const r = x as Record<string, unknown>;
  return (
    isIdField(r.cardId) &&
    isIdField(r.memberKey) &&
    isInboxCapability(r.lifecycleInbox)
  );
}

// One pending invite (doc 33, slice 4a): an id, a lifecycle inbox, a non-negative
// integer createdDay, and an optional private label capped like a contact label.
function isPendingGroupInvite(x: unknown): x is PendingGroupInvite {
  if (typeof x !== "object" || x === null) return false;
  const r = x as Record<string, unknown>;
  return (
    isIdField(r.inviteId) &&
    isInboxCapability(r.lifecycleInbox) &&
    typeof r.createdDay === "number" &&
    Number.isInteger(r.createdDay) &&
    r.createdDay >= 0 &&
    (r.label === undefined ||
      (typeof r.label === "string" && r.label.length <= MAX_CONTACT_LABEL))
  );
}

// The admin-only roster + pending invites and the member-only lifecycle inbox and
// accept-day stamp, each optional (a fresh group, or a record for the other role,
// omits the ones it does not use) and strictly shaped when present.
function hasGroupMembership(r: Record<string, unknown>): boolean {
  return (
    (r.members === undefined ||
      (Array.isArray(r.members) && r.members.every(isGroupMemberSecret))) &&
    (r.pendingInvites === undefined ||
      (Array.isArray(r.pendingInvites) &&
        r.pendingInvites.every(isPendingGroupInvite))) &&
    (r.lifecycleInbox === undefined || isInboxCapability(r.lifecycleInbox)) &&
    (r.joinedDay === undefined ||
      (typeof r.joinedDay === "number" &&
        Number.isInteger(r.joinedDay) &&
        r.joinedDay >= 0))
  );
}

// The group's non-capability fields: a well-SHAPED handle (charset only, not the
// mutable reserved/blocked sets, so a later blocklist growth never bricks a stored
// group, mirroring the findable name), the visibility + meetingKind enums, the
// admin flag, and the optional join-pointer tokens (present only for a claimed
// public handle).
function hasGroupMeta(r: Record<string, unknown>): boolean {
  return (
    hasVanityNameShape(r.handle) &&
    (r.visibility === "public" || r.visibility === "private") &&
    (r.meetingKind === "event" || r.meetingKind === "recurring") &&
    typeof r.isAdmin === "boolean" &&
    isOptionalIdField(r.joinPointerId) &&
    isOptionalIdField(r.joinWriteToken) &&
    // The shown-face override (doc 33): a well-shaped handle fails closed; the
    // avatar is NOT validated here (migrated on read by migrateGroupAvatar below),
    // so a bad/old-shape one is dropped rather than invalidating the whole record.
    (r.myHandle === undefined || isValidHandle(r.myHandle))
  );
}

// A group record (doc 33). An admin rewrites the blob and holds the shared key, so
// its record must carry both the group write token and `kg`; a member's record is
// valid without them (doc 33, slice 4a).
function isGroupRecord(x: unknown): x is GroupRecord {
  if (typeof x !== "object" || x === null) return false;
  const r = x as Record<string, unknown>;
  if (!hasGroupCapabilities(r) || !hasGroupMeta(r) || !hasGroupMembership(r)) {
    return false;
  }
  if (r.isAdmin === true)
    return isIdField(r.groupWriteToken) && isIdField(r.kg);
  return true;
}

// groups is optional on the account (absent until the owner creates or joins one).
function isOptionalGroups(x: unknown): boolean {
  return x === undefined || (Array.isArray(x) && x.every(isGroupRecord));
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

// The password set/changed timestamp (doc 32): absent, or a non-negative finite
// epoch-ms instant. A malformed value fails the parse rather than mis-timing the
// yearly nudge.
function isOptionalPasswordSetAt(x: unknown): boolean {
  return (
    x === undefined || (typeof x === "number" && Number.isFinite(x) && x >= 0)
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
    ...(blob.homeDefaultView !== undefined
      ? { homeDefaultView: blob.homeDefaultView }
      : {}),
    ...(blob.circles !== undefined ? { circles: blob.circles } : {}),
    ...(blob.findables !== undefined ? { findables: blob.findables } : {}),
    ...(blob.groups !== undefined ? { groups: blob.groups } : {}),
    ...(blob.recoveryName !== undefined
      ? { recoveryName: blob.recoveryName }
      : {}),
    ...(blob.recoveryPhrase !== undefined
      ? { recoveryPhrase: blob.recoveryPhrase }
      : {}),
    ...(blob.passwordSetAt !== undefined
      ? { passwordSetAt: blob.passwordSetAt }
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
  assertValidOptionalFields(o);
}

// The optional account-level fields (absent on a pre-feature account). The notify
// inboxes now live per contact (myInbox), validated inside isContactRecord.
function assertValidOptionalFields(o: Record<string, unknown>): void {
  if (!isOptionalCircles(o.circles)) {
    throw new Error("account blob: invalid circles");
  }
  if (!isOptionalFindables(o.findables)) {
    throw new Error("account blob: invalid findables");
  }
  if (!isOptionalGroups(o.groups)) {
    throw new Error("account blob: invalid groups");
  }
  if (!isOptionalRecoveryName(o.recoveryName)) {
    throw new Error("account blob: invalid recoveryName");
  }
  if (!isOptionalRecoveryPhrase(o.recoveryPhrase)) {
    throw new Error("account blob: invalid recoveryPhrase");
  }
  if (!isOptionalPasswordSetAt(o.passwordSetAt)) {
    throw new Error("account blob: invalid passwordSetAt");
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
    ...(o.homeDefaultView === "criteria" || o.homeDefaultView === "shared"
      ? { homeDefaultView: o.homeDefaultView }
      : {}),
    ...(Array.isArray(o.circles)
      ? { circles: o.circles as CircleRecord[] }
      : {}),
    ...(isFindablesArray(o.findables) ? { findables: o.findables } : {}),
    ...(Array.isArray(o.groups)
      ? { groups: (o.groups as GroupRecord[]).map(migrateGroupAvatar) }
      : {}),
    ...(hasVanityNameShape(o.recoveryName)
      ? { recoveryName: o.recoveryName }
      : {}),
    ...(typeof o.recoveryPhrase === "string"
      ? { recoveryPhrase: o.recoveryPhrase }
      : {}),
    ...(typeof o.passwordSetAt === "number"
      ? { passwordSetAt: o.passwordSetAt }
      : {}),
  };
}

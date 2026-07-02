/**
 * The shared-group blob codec (doc 33, slice 3): the internal structure slice 2
 * carries as opaque fixed-size bytes. One blob describes a whole group, sealed so
 * only members can read it, and is written by an admin and polled by members.
 *
 * The hard constraint (doc 33 decision 1) is that the group blob adds NO oracle
 * the alias store does not already have. An alias payload is pure fixed-size AEAD
 * ciphertext: indistinguishable from random, so a real payload and the server's
 * decoy-on-miss are byte-shape identical and its true plaintext length is hidden
 * inside the AEAD (sealToSize). The group blob must hold the same property, which
 * rules out ANY cleartext framing (a version byte, a length, a member count): all
 * of those would betray a real blob from a decoy AND leak the group's size to the
 * server. So the whole blob is random-looking bytes, and its layout is FIXED and
 * positional rather than length-prefixed.
 *
 * The blob has two parts, split for one reason: a member who is only just joining
 * holds their own member key but NOT `Kg` yet, so the thing that hands them `Kg`
 * cannot itself be sealed under `Kg`.
 *
 * - Member slots: a FIXED number (`GROUP_MEMBER_CAP`) of fixed-width slots. Each
 *   real member's slot is `wrapGroupKey(Kg, memberKey_i)` (openable with ONLY that
 *   member's key); every unused slot is random bytes. A real wrap and a random
 *   fill are both indistinguishable from random, so the slot region reveals
 *   neither how many members there are nor which slots are live. A member finds
 *   theirs by trial-unwrapping the slots with their own key (unwrapGroupKey rejects
 *   a wrong key, so we catch and continue). The cap is tens, so the trial is cheap.
 *   Slice 4 adds a member by filling a free slot; the format is built for that.
 * - Core: the group object (handle, roster, admin flag, ...) sealed UNDER `Kg`
 *   with the FIXED-size AEAD (sealToSize), so its length hides the roster size the
 *   same way an alias payload hides its card. Once a member has `Kg` they open it.
 *
 * On the wire the whole thing is ONE fixed-size (GROUP_BLOB_SIZE) payload:
 *
 *   [ GROUP_MEMBER_CAP slots * WRAP_WIDTH bytes ][ core: CORE_SIZE bytes ]
 *
 * There is no on-wire version byte (it would break uniformity); the format is
 * versioned INSIDE the sealed core instead, so a bad version fails closed after
 * decryption. Every parse fails CLOSED to `null` on any surprise (wrong key,
 * tamper, wrong size, bad version), exactly like openGroupCard /
 * backendStore.resolveAlias: a group is never half-rendered under a key that
 * cannot open it, and a decoy (random bytes on a miss) simply opens to nothing.
 */

import { GROUP_BLOB_SIZE, validId } from "../api/contract.ts";
import {
  importAesKey,
  sealToSize,
  openSized,
  utf8ToBytes,
  bytesToUtf8,
  type Bytes,
} from "../crypto/index.ts";
import { hasVanityNameShape } from "./vanityName.ts";
import {
  unwrapGroupKey,
  type GroupKey,
  type MemberKey,
} from "./groupCrypto.ts";

/** Whether the group can be found by its public handle (doc 33). Public resolves
 * like a findable name to a join pointer; private is invite-only. */
export type GroupVisibility = "public" | "private";

/** How the notify scope is computed (doc 33): a one-time event vs a recurring
 * meeting. Carried now so the format is set; the fan-out lands in slice 6. */
export type MeetingKind = "event" | "recurring";

export function isGroupVisibility(x: unknown): x is GroupVisibility {
  return x === "public" || x === "private";
}

export function isMeetingKind(x: unknown): x is MeetingKind {
  return x === "event" || x === "recurring";
}

/** One roster entry: the opaque alias id where that member publishes their status
 * card sealed under `Kg` (doc 33). No key here; the card key is `Kg` itself. */
export interface RosterEntry {
  readonly cardId: string;
}

/**
 * The group object sealed in the core. Everything a member needs to read the group
 * once they hold `Kg`: its address, its scope, who the admin is, and every
 * member's card id. `adminCardId` names which roster entry is the admin; in v1 it
 * is the creator's own card id (the sole admin).
 */
export interface GroupObject {
  readonly handle: string;
  readonly visibility: GroupVisibility;
  readonly meetingKind: MeetingKind;
  readonly adminCardId: string;
  readonly roster: readonly RosterEntry[];
}

// The fixed slot geometry. WRAP_WIDTH is the exact length wrapGroupKey produces
// for a 32-byte Kg (iv 12 + ciphertext 32 + gcm tag 16); we assert real wraps
// match it so a crypto change fails loudly instead of silently corrupting slots.
// GROUP_MEMBER_CAP is a hard cap (a soft cap of tens is the design target, doc
// 33): a group cannot exceed it because every member needs a slot. The core takes
// whatever the slots do not, sealed to a fixed size so the roster length is hidden.
const WRAP_WIDTH = 12 + 32 + 16; // 60
const GROUP_MEMBER_CAP = 64;
const MEMBER_SECTION = GROUP_MEMBER_CAP * WRAP_WIDTH; // 3840
const CORE_SIZE = GROUP_BLOB_SIZE - MEMBER_SECTION; // 12544

// The group object is a small JSON versioned INSIDE the sealed core (never on the
// wire, which must stay uniform). A mismatch on parse fails closed.
const GROUP_OBJECT_VERSION = 1;

function serializeGroupObject(obj: GroupObject): Bytes {
  return utf8ToBytes(
    JSON.stringify({
      v: GROUP_OBJECT_VERSION,
      handle: obj.handle,
      visibility: obj.visibility,
      meetingKind: obj.meetingKind,
      adminCardId: obj.adminCardId,
      roster: obj.roster.map((r) => ({ cardId: r.cardId })),
    }),
  );
}

function isRosterEntry(x: unknown): x is RosterEntry {
  if (typeof x !== "object" || x === null) return false;
  const r = x as Record<string, unknown>;
  return typeof r.cardId === "string" && validId(r.cardId);
}

// Strictly validate a decoded object as a well-formed group object of the expected
// version. A type predicate so the caller can construct without re-checking; every
// false path is a fail-closed null upstream. Handle is shape-only (charset, not the
// mutable reserved/blocked sets) so a later blocklist growth never bricks a stored
// group, mirroring the findable name.
function isGroupObjectShape(
  o: Record<string, unknown>,
): o is Record<string, unknown> & GroupObject & { v: number } {
  return (
    o.v === GROUP_OBJECT_VERSION &&
    hasVanityNameShape(o.handle) &&
    isGroupVisibility(o.visibility) &&
    isMeetingKind(o.meetingKind) &&
    typeof o.adminCardId === "string" &&
    validId(o.adminCardId) &&
    Array.isArray(o.roster) &&
    o.roster.every(isRosterEntry)
  );
}

// Parse + strictly validate the group object, throwing on any surprise so the
// callers below map it to the uniform null.
function parseGroupObject(bytes: Bytes): GroupObject {
  const raw: unknown = JSON.parse(bytesToUtf8(bytes));
  if (typeof raw !== "object" || raw === null) {
    throw new Error("group object: not an object");
  }
  const o = raw as Record<string, unknown>;
  if (!isGroupObjectShape(o)) throw new Error("group object: invalid");
  return {
    handle: o.handle,
    visibility: o.visibility,
    meetingKind: o.meetingKind,
    adminCardId: o.adminCardId,
    roster: o.roster.map((r) => ({ cardId: r.cardId })),
  };
}

/**
 * Build the fixed-size group blob: seal `obj` under `Kg` into the fixed-size core,
 * lay the per-member `wrappedKeys` into the first slots, and leave every other
 * slot as the random bytes the whole buffer starts as. The result is
 * GROUP_BLOB_SIZE of random-looking bytes with no cleartext framing, so it is
 * byte-shape identical to the server's decoy-on-miss (existence-uniform) and
 * reveals neither the member count nor the roster size. Throws if there are more
 * wrapped keys than slots, or if a wrapped key is not the expected width.
 */
export async function serializeGroupBlob(
  Kg: GroupKey,
  obj: GroupObject,
  wrappedKeys: readonly Bytes[],
): Promise<Bytes> {
  if (wrappedKeys.length > GROUP_MEMBER_CAP) {
    throw new Error("serializeGroupBlob: more members than slots");
  }
  if (wrappedKeys.some((wk) => wk.length !== WRAP_WIDTH)) {
    throw new Error("serializeGroupBlob: wrapped key wrong width");
  }
  // Start from random so every unused slot (and the whole buffer) is random-looking.
  const out = crypto.getRandomValues(new Uint8Array(GROUP_BLOB_SIZE));
  wrappedKeys.forEach((wk, i) => out.set(wk, i * WRAP_WIDTH));
  const core = await sealToSize(
    await importAesKey(Kg),
    serializeGroupObject(obj),
    CORE_SIZE,
  );
  out.set(core, MEMBER_SECTION);
  return out;
}

// The two fixed regions of a well-sized blob. Throws if the blob is not exactly
// GROUP_BLOB_SIZE, so a short or oversized buffer fails closed like everything else.
function regions(blob: Bytes): { slots: Bytes[]; core: Bytes } {
  if (blob.length !== GROUP_BLOB_SIZE) {
    throw new Error("group blob: wrong size");
  }
  const slots: Bytes[] = [];
  for (let i = 0; i < GROUP_MEMBER_CAP; i++) {
    slots.push(blob.subarray(i * WRAP_WIDTH, (i + 1) * WRAP_WIDTH));
  }
  return { slots, core: blob.subarray(MEMBER_SECTION) };
}

/**
 * A joining member's path: they hold their member key but not `Kg`. Trial-unwrap
 * every slot with `memberKey` (first success is `Kg`), then open + parse the core
 * under it. Returns `{ Kg, obj }`, or `null` if no slot was addressed to this
 * member or anything is malformed (fail closed). A decoy (random bytes on a miss)
 * lands here too and returns `null`, so existence stays undetectable.
 */
export async function parseGroupBlobForMember(
  blob: Bytes,
  memberKey: MemberKey,
): Promise<{ Kg: GroupKey; obj: GroupObject } | null> {
  try {
    const { slots, core } = regions(blob);
    let Kg: GroupKey | null = null;
    for (const slot of slots) {
      try {
        Kg = await unwrapGroupKey(slot, memberKey);
        break; // ours; the rest are other members' or random fill
      } catch {
        // Not addressed to this member (GCM rejected); keep trying.
      }
    }
    if (Kg === null) return null;
    const obj = parseGroupObject(await openSized(await importAesKey(Kg), core));
    return { Kg, obj };
  } catch {
    return null;
  }
}

/**
 * The common local path: a member/admin who already holds `Kg` skips the member
 * slots and opens the core directly. Returns the group object, or `null` on a
 * wrong `Kg`, tamper, wrong size, or malformed core (fail closed).
 */
export async function parseGroupBlobWithKg(
  blob: Bytes,
  Kg: GroupKey,
): Promise<GroupObject | null> {
  try {
    const { core } = regions(blob);
    return parseGroupObject(await openSized(await importAesKey(Kg), core));
  } catch {
    return null;
  }
}

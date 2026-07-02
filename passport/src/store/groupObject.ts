/**
 * The shared-group blob codec (doc 33, slice 3): the internal structure slice 2
 * carries as opaque fixed-size bytes. One blob describes a whole group, sealed so
 * only members can read it, and is written by an admin and polled by members.
 *
 * The blob has two parts, split for one reason: a member who is only just joining
 * holds their own member key but NOT `Kg` yet, so the thing that hands them `Kg`
 * cannot itself be sealed under `Kg`.
 *
 * - `wrappedKeys`: one `wrapGroupKey(Kg, memberKey_i)` per member, each openable
 *   with ONLY that member's key. A member finds theirs by trial-unwrapping every
 *   entry with their own key (unwrapGroupKey rejects a wrong key, so we catch and
 *   continue). N is tens, so N trial-decrypts is cheap. Slice 4 adds members by
 *   appending an entry here; the format is built for that from the start.
 * - `core`: the group object (handle, roster, admin flag, ...) sealed UNDER `Kg`
 *   with the variable-length AEAD. Once a member has `Kg` they open this directly.
 *
 * On the wire the whole thing is ONE fixed-size (GROUP_BLOB_SIZE) payload:
 *
 *   [version:u8][payloadLen:u32][payload][random padding to GROUP_BLOB_SIZE]
 *   payload = [count:u16][ (len:u16, bytes) per wrappedKey ][ (len:u32, bytes) core ]
 *
 * The padding is random (crypto.getRandomValues), never zero-fill, so a group blob
 * is byte-shape identical to any other and its true size leaks nothing (no zero-run
 * oracle). Every parse fails CLOSED to `null` on any surprise (bad version, wrong
 * key, tamper, malformed), exactly like openGroupCard / backendStore.resolveAlias:
 * a group is never half-rendered under a key that cannot open it.
 */

import { GROUP_BLOB_SIZE, validId } from "../api/contract.ts";
import {
  importAesKey,
  seal,
  open,
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
 * The group object sealed in `core`. Everything a member needs to read the group
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

// The blob version and the fixed prefix widths. The version byte lets a later
// slice change the layout without mis-parsing an old blob; a mismatch fails closed.
const GROUP_BLOB_VERSION = 1;
const VERSION_BYTES = 1;
const PAYLOAD_LEN_BYTES = 4;
const FRAME_PREFIX = VERSION_BYTES + PAYLOAD_LEN_BYTES; // [version:u8][payloadLen:u32]
const COUNT_BYTES = 2; // [count:u16]
const WRAPPED_LEN_BYTES = 2; // [len:u16] per wrapped key
const CORE_LEN_BYTES = 4; // [len:u32] for the core
const U16_MAX = 0xffff;
const U32_MAX = 0xffffffff;

// The group object is a small versioned-by-the-blob JSON. Reuses the same
// TextEncoder path the other codecs use; the outer blob version guards its shape,
// so it carries no separate version tag of its own.
function serializeGroupObject(obj: GroupObject): Bytes {
  return utf8ToBytes(
    JSON.stringify({
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

// Parse + strictly validate the group object, throwing on any surprise so the
// callers below map it to the uniform null.
function parseGroupObject(bytes: Bytes): GroupObject {
  const raw: unknown = JSON.parse(bytesToUtf8(bytes));
  if (typeof raw !== "object" || raw === null) {
    throw new Error("group object: not an object");
  }
  const o = raw as Record<string, unknown>;
  if (!hasVanityNameShape(o.handle)) {
    throw new Error("group object: invalid handle");
  }
  if (!isGroupVisibility(o.visibility)) {
    throw new Error("group object: invalid visibility");
  }
  if (!isMeetingKind(o.meetingKind)) {
    throw new Error("group object: invalid meetingKind");
  }
  if (typeof o.adminCardId !== "string" || !validId(o.adminCardId)) {
    throw new Error("group object: invalid adminCardId");
  }
  if (!Array.isArray(o.roster) || !o.roster.every(isRosterEntry)) {
    throw new Error("group object: invalid roster");
  }
  return {
    handle: o.handle,
    visibility: o.visibility,
    meetingKind: o.meetingKind,
    adminCardId: o.adminCardId,
    roster: o.roster.map((r) => ({ cardId: r.cardId })),
  };
}

// Validate the framed parts fit their length fields (throws), so an over-capacity
// group (too many members, too large a core) fails loudly here rather than
// silently truncating.
function assertFramable(wrappedKeys: readonly Bytes[], coreLen: number): void {
  if (wrappedKeys.length > U16_MAX) {
    throw new Error("serializeGroupBlob: too many members");
  }
  if (coreLen > U32_MAX) throw new Error("serializeGroupBlob: core too large");
  if (wrappedKeys.some((wk) => wk.length > U16_MAX)) {
    throw new Error("serializeGroupBlob: wrapped key too large");
  }
}

// Build the framed payload `[count:u16][ (len:u16, bytes)* ][ (len:u32, core) ]`.
function framedPayload(wrappedKeys: readonly Bytes[], core: Bytes): Bytes {
  assertFramable(wrappedKeys, core.length);
  const len =
    wrappedKeys.reduce(
      (n, wk) => n + WRAPPED_LEN_BYTES + wk.length,
      COUNT_BYTES,
    ) +
    CORE_LEN_BYTES +
    core.length;
  const out = new Uint8Array(len);
  const view = new DataView(out.buffer);
  // Write one big-endian length-prefixed chunk `[len:widthBytes][bytes]` at `off`,
  // returning the offset just past it (u16 for wrapped keys, u32 for the core).
  const writeChunk = (off: number, bytes: Bytes, widthBytes: 2 | 4): number => {
    if (widthBytes === 2) view.setUint16(off, bytes.length, false);
    else view.setUint32(off, bytes.length, false);
    out.set(bytes, off + widthBytes);
    return off + widthBytes + bytes.length;
  };
  view.setUint16(0, wrappedKeys.length, false);
  let off = COUNT_BYTES;
  for (const wk of wrappedKeys) off = writeChunk(off, wk, WRAPPED_LEN_BYTES);
  writeChunk(off, core, CORE_LEN_BYTES);
  return out;
}

/**
 * Build the fixed-size group blob: seal `obj` under `Kg` for the core, frame it
 * with the per-member `wrappedKeys`, and pad the rest to GROUP_BLOB_SIZE with
 * random bytes. Throws if the framed payload would overflow the blob.
 */
export async function serializeGroupBlob(
  Kg: GroupKey,
  obj: GroupObject,
  wrappedKeys: readonly Bytes[],
): Promise<Bytes> {
  const core = await seal(await importAesKey(Kg), serializeGroupObject(obj));
  const payload = framedPayload(wrappedKeys, core);
  if (FRAME_PREFIX + payload.length > GROUP_BLOB_SIZE) {
    throw new Error("serializeGroupBlob: payload overflows the blob");
  }
  // Fill the ENTIRE blob with random bytes first, then overwrite the framed prefix
  // + payload; the trailing region stays random, so the padding carries no zero-run
  // that would betray the real payload's length.
  const out = crypto.getRandomValues(new Uint8Array(GROUP_BLOB_SIZE));
  const view = new DataView(out.buffer);
  out[0] = GROUP_BLOB_VERSION;
  view.setUint32(VERSION_BYTES, payload.length, false);
  out.set(payload, FRAME_PREFIX);
  return out;
}

// The framed parts of a blob: every wrapped key and the sealed core. Throws on any
// structural surprise (short buffer, bad version, a length that runs past the
// declared payload), so the public parsers below can uniformly fail closed.
interface GroupFraming {
  readonly wrappedKeys: Bytes[];
  readonly core: Bytes;
}

// Read `span.count` u16 length-prefixed wrapped keys from `span.start`, returning
// the keys and the offset just past them; a length that runs past `span.end`
// throws (fail closed).
function readWrappedKeys(
  view: DataView,
  blob: Bytes,
  span: { start: number; count: number; end: number },
): { keys: Bytes[]; off: number } {
  const keys: Bytes[] = [];
  let off = span.start;
  for (let i = 0; i < span.count; i++) {
    if (off + WRAPPED_LEN_BYTES > span.end) {
      throw new Error("group blob: short len");
    }
    const len = view.getUint16(off, false);
    off += WRAPPED_LEN_BYTES;
    if (off + len > span.end) throw new Error("group blob: wrapped overflows");
    keys.push(blob.slice(off, off + len));
    off += len;
  }
  return { keys, off };
}

function parseFraming(blob: Bytes): GroupFraming {
  if (blob.length < FRAME_PREFIX) throw new Error("group blob: too short");
  if (blob[0] !== GROUP_BLOB_VERSION)
    throw new Error("group blob: bad version");
  const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength);
  const end = FRAME_PREFIX + view.getUint32(VERSION_BYTES, false);
  if (end > blob.length) throw new Error("group blob: payload overflows");
  if (FRAME_PREFIX + COUNT_BYTES > end) throw new Error("group blob: no count");
  const count = view.getUint16(FRAME_PREFIX, false);
  const { keys, off } = readWrappedKeys(view, blob, {
    start: FRAME_PREFIX + COUNT_BYTES,
    count,
    end,
  });
  if (off + CORE_LEN_BYTES > end) throw new Error("group blob: no core len");
  const coreLen = view.getUint32(off, false);
  const coreStart = off + CORE_LEN_BYTES;
  if (coreStart + coreLen > end) throw new Error("group blob: core overflows");
  return {
    wrappedKeys: keys,
    core: blob.slice(coreStart, coreStart + coreLen),
  };
}

/**
 * A joining member's path: they hold their member key but not `Kg`. Trial-unwrap
 * every entry with `memberKey` (first success is `Kg`), then open + parse the core
 * under it. Returns `{ Kg, obj }`, or `null` if none of the entries were addressed
 * to this member or anything is malformed (fail closed).
 */
export async function parseGroupBlobForMember(
  blob: Bytes,
  memberKey: MemberKey,
): Promise<{ Kg: GroupKey; obj: GroupObject } | null> {
  try {
    const { wrappedKeys, core } = parseFraming(blob);
    let Kg: GroupKey | null = null;
    for (const wk of wrappedKeys) {
      try {
        Kg = await unwrapGroupKey(wk, memberKey);
        break; // ours; the rest are for other members
      } catch {
        // Not addressed to this member (GCM rejected); keep trying.
      }
    }
    if (Kg === null) return null;
    const obj = parseGroupObject(await open(await importAesKey(Kg), core));
    return { Kg, obj };
  } catch {
    return null;
  }
}

/**
 * The common local path: a member/admin who already holds `Kg` skips the
 * wrappedKeys entirely and opens the core directly. Returns the group object, or
 * `null` on a wrong `Kg`, tamper, or malformed blob (fail closed).
 */
export async function parseGroupBlobWithKg(
  blob: Bytes,
  Kg: GroupKey,
): Promise<GroupObject | null> {
  try {
    const { core } = parseFraming(blob);
    return parseGroupObject(await open(await importAesKey(Kg), core));
  } catch {
    return null;
  }
}

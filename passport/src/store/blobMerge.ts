/**
 * Three-way merge of the owner's account blob (doc 22 S8). When two of the owner's
 * devices edit the same account concurrently (one offline, then reconnecting), the
 * server refuses the stale push with a 409 (optimistic concurrency). The reconnecting
 * device then reloads the server's copy and merges its own edits onto it HERE, rather
 * than clobbering the other device's change. The blind server cannot merge (it only
 * holds ciphertext), so this runs client-side with the root key in hand.
 *
 * It is a real 3-way merge: `base` is the last server state this device synced with
 * (the common ancestor), `mine` is this device's working copy, `theirs` is the
 * server's current copy. The ancestor is what lets us tell "I added this" from "they
 * removed it", so a concurrent edit on one field never silently reverts another.
 *
 * Two policy choices, both biased toward safety for a privacy product (named in
 * doc 22 S8 so a reviewer sees them):
 *
 *  - DELETE WINS. A record present in `base` but dropped on EITHER side is treated as
 *    deleted and stays gone, even if the other side edited it. Revoking a contact or
 *    an alias is a deliberate, safety-bearing act; a concurrent edit must never
 *    resurrect a link the owner cut.
 *  - On a true same-field divergence (both sides changed the SAME scalar, or the same
 *    record's fields, to different values), MINE wins, since this is the device the
 *    owner is actively using. The badge is always recomputed locally from whatever
 *    state survives, and the owner can re-edit, so this is self-correcting.
 *
 * The merge is field- and record-level; it does not re-check cross-references (e.g. a
 * surviving `findable` whose alias was concurrently revoked just fails to resolve,
 * the same harmless state an expired link reaches). Output is a valid AccountBlob.
 */

import type {
  AccountBlob,
  AliasRecord,
  ContactRecord,
  CircleRecord,
  FindableRegistration,
} from "./accountBlob.ts";

/** Structural equality for the plain JSON values a blob is built from. */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (
    typeof a !== "object" ||
    typeof b !== "object" ||
    a === null ||
    b === null
  ) {
    return false;
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  const keys = Object.keys(ra);
  if (keys.length !== Object.keys(rb).length) return false;
  for (const k of keys) {
    if (!Object.prototype.hasOwnProperty.call(rb, k)) return false;
    if (!deepEqual(ra[k], rb[k])) return false;
  }
  return true;
}

/**
 * Three-way pick for a single value: if I left it untouched, take theirs (they may
 * have changed it); if only I changed it, take mine; if we both changed it to
 * different values, mine wins (the actively-used device). Works for an undefined
 * value too (an absent optional field), so it handles `findable` directly.
 */
function pickScalar<T>(base: T, mine: T, theirs: T): T {
  if (deepEqual(mine, base)) return theirs;
  if (deepEqual(theirs, base)) return mine;
  return mine;
}

/**
 * Three-way merge of a list of id-keyed records (aliases, contacts, circles). A
 * record survives only if it is present on BOTH sides, or was freshly ADDED by one
 * side (present there, absent in the ancestor). A record present in the ancestor but
 * dropped on either side is deleted and stays gone (DELETE WINS). When a record is on
 * both sides with differing fields, its fields are reconciled with the same scalar
 * rule. Order follows `mine` first, then records only `theirs` added, so the result
 * is deterministic.
 */
function mergeByKey<T>(
  base: readonly T[],
  mine: readonly T[],
  theirs: readonly T[],
  keyOf: (x: T) => string,
): T[] {
  const b = new Map(base.map((x) => [keyOf(x), x]));
  const m = new Map(mine.map((x) => [keyOf(x), x]));
  const t = new Map(theirs.map((x) => [keyOf(x), x]));
  const out: T[] = [];
  const keys = new Set<string>([...m.keys(), ...t.keys()]);
  for (const k of keys) {
    const mi = m.get(k);
    const ti = t.get(k);
    if (mi !== undefined && ti !== undefined) {
      // Both sides have it. With an ancestor, reconcile field-by-field. With NONE
      // (both devices independently added the same key), it is a true divergence, so
      // mine wins per the policy above; standing in `ti` as the pseudo-ancestor makes
      // pickScalar return mine on any differing field (and either when identical).
      out.push(pickScalar(b.get(k) ?? ti, mi, ti));
      continue;
    }
    // Present on one side only: kept only when it is a fresh add (not in the
    // ancestor), so a record the other side deleted stays deleted.
    const only = mi ?? ti;
    if (only !== undefined && !b.has(k)) out.push(only);
  }
  return out;
}

function mergeById<T extends { readonly id: string }>(
  base: readonly T[],
  mine: readonly T[],
  theirs: readonly T[],
): T[] {
  return mergeByKey(base, mine, theirs, (x) => x.id);
}

/** Merge `mine` onto `theirs` over their common ancestor `base` (doc 22 S8). */
export function mergeAccountBlobs(
  base: AccountBlob,
  mine: AccountBlob,
  theirs: AccountBlob,
): AccountBlob {
  const circles = mergeById<CircleRecord>(
    base.circles ?? [],
    mine.circles ?? [],
    theirs.circles ?? [],
  );
  // Public names merge by name like any add-or-both list (delete wins): two devices
  // that each claimed a different name offline both survive. Names are unique (the
  // server rejects a duplicate claim), so a name is never on both sides with a
  // different alias. A rare offline race can union past MAX_PUBLIC_NAMES; that stays a
  // valid blob (the cap is a claim-time rule, not a storage invariant) and self-heals
  // as the owner removes one, so no live public name is silently orphaned here.
  const findables = mergeByKey<FindableRegistration>(
    base.findables ?? [],
    mine.findables ?? [],
    theirs.findables ?? [],
    (f) => f.name,
  );
  const handle = pickScalar(base.handle, mine.handle, theirs.handle);
  return {
    ...(handle !== undefined ? { handle } : {}),
    aliases: mergeById<AliasRecord>(base.aliases, mine.aliases, theirs.aliases),
    contacts: mergeById<ContactRecord>(
      base.contacts,
      mine.contacts,
      theirs.contacts,
    ),
    state: pickScalar(base.state, mine.state, theirs.state),
    avatar: pickScalar(base.avatar, mine.avatar, theirs.avatar),
    // Optional fields are omitted when empty/absent, matching serializeAccountBlob.
    ...(circles.length > 0 ? { circles } : {}),
    ...(findables.length > 0 ? { findables } : {}),
  };
}

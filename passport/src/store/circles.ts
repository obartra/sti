/**
 * Circles (doc 13 slice 6): purely client-side bundles of contacts with a shared
 * display. The server never learns a circle exists; group status sharing reuses
 * each member's existing pairwise channel, so a circle is only a local grouping.
 *
 * The privacy-critical rule is the min-group-5 hide floor: a member's status is
 * shown within a circle only when the circle has at least five members. Below that,
 * the whole circle hides (never reveals a partial set), so a status can never be
 * pinpointed to one person in a tiny group. The floor is on the GROUP SIZE, not on
 * how many members have a resolved status.
 */

import type {
  AccountBlob,
  CircleRecord,
  ContactRecord,
} from "./accountBlob.ts";
import type { PassportStore } from "./passportStore.ts";

/** A circle member's two-state display tone (the membership color, not the badge). */
export type CircleTone = "blue" | "gray";

/** One roster row: a member, the owner's private label for them, and their tone. */
export interface CircleRosterMember {
  readonly contactId: string;
  /** The owner's private nickname for this contact; shown only to the owner. */
  readonly label: string;
  readonly tone: CircleTone;
}

/**
 * The smallest circle that may display member statuses. Below this a circle hides
 * entirely, so an individual's status is never inferable from a small group.
 */
export const MIN_CIRCLE_SIZE = 5;

/** Whether a circle is large enough to display member statuses at all. */
export function circleMeetsFloor(circle: CircleRecord): boolean {
  return circle.memberContactIds.length >= MIN_CIRCLE_SIZE;
}

/**
 * The member statuses a circle may display, or null when the circle is below the
 * floor (hidden, never a partial reveal). Above the floor, returns the resolved
 * status for each member that has one, in membership order; members without a
 * resolved status are simply absent (no placeholder leaks who is missing).
 */
export function visibleCircleStatuses<T>(
  circle: CircleRecord,
  statusByContactId: ReadonlyMap<string, T>,
): T[] | null {
  if (!circleMeetsFloor(circle)) return null;
  return circle.memberContactIds
    .map((id) => statusByContactId.get(id))
    .filter((s): s is T => s !== undefined);
}

/**
 * Resolve a circle to its display roster, or null when the circle is below the
 * min-5 floor (hidden entirely, never a partial reveal). Each member is blue only
 * when their shared status currently reads blue; everything else (no exchanged
 * status alias, an unreachable or again-uniform resolve, a non-blue card) is gray.
 * Resolution is fail-closed per member, so one unreachable member never errors the
 * roster, and the count and order always match the circle's membership.
 */
export async function resolveCircleRoster(
  circle: CircleRecord,
  contacts: readonly ContactRecord[],
  resolveAlias: PassportStore["resolveAlias"],
): Promise<CircleRosterMember[] | null> {
  if (!circleMeetsFloor(circle)) return null;
  const byId = new Map(contacts.map((c) => [c.id, c]));
  return Promise.all(
    circle.memberContactIds.map(async (id) => {
      const contact = byId.get(id);
      return {
        contactId: id,
        label: contact?.label ?? "",
        tone: contact ? await memberTone(contact, resolveAlias) : "gray",
      };
    }),
  );
}

// A member is blue only when their read-only status alias currently resolves to a
// blue card; an unexchanged alias, a null (uniform) resolve, or a gray card is gray.
async function memberTone(
  contact: ContactRecord,
  resolveAlias: PassportStore["resolveAlias"],
): Promise<CircleTone> {
  const alias = contact.theirStatusAlias;
  if (alias === undefined) return "gray";
  try {
    const view = await resolveAlias({ id: alias.id, key: alias.key });
    return view?.state === "blue" ? "blue" : "gray";
  } catch {
    // Fail-closed: an unreachable resolve reads as gray, never errors the roster.
    return "gray";
  }
}

/**
 * Normalize a proposed member set against the account: drop ids that are not
 * current contacts (e.g. a removed contact) and dedupe, preserving first-seen
 * order. Keeps a circle from ever referencing a contact that no longer exists.
 */
export function normalizeCircleMembers(
  blob: AccountBlob,
  memberContactIds: readonly string[],
): string[] {
  const known = new Set(blob.contacts.map((c) => c.id));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of memberContactIds) {
    if (known.has(id) && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

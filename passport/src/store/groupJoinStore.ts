/**
 * The device-local state for the shared-group REQUEST path (doc 33, slice 4b), the
 * pre-membership bookkeeping the design deliberately keeps OFF the synced account
 * blob (a request is not yet membership). It holds two small, device-local lists,
 * one per role, mirroring the viewer's pendingKnockStore:
 *
 * - Requester side: the public groups this device asked to join (the join pointer id
 *   plus the handle it asked under). It exists so a return visit can redeem an
 *   approval: the requester polls each pending join's grant slot and, on success,
 *   runs the accept back-half. The grant keypair and requester secret that make the
 *   poll work already persist (grantKeyStore, requesterStore), keyed by the join
 *   pointer id; this is the list that says which pointers to poll.
 * - Admin side: the requests this device DISMISSED (rejected). A reject writes
 *   nothing to the server (a server-side rejection signal would be a new oracle for
 *   no benefit, doc 33), so it is remembered locally by (groupId, requesterHash) and
 *   filtered out of later reviews. The knock itself self-expires (KnockTTL).
 *
 * Neither is an identity and neither leaves the device: the requester list holds
 * opaque pointer ids the device already has, the dismissed set holds opaque hashes.
 * Like faves it is purely local, never in the synced blob, so it adds no
 * server-visible data and simply does not follow a recovery onto a new device.
 * Storage is injected (StorageLike) so it is unit-testable in memory, and every read
 * fails CLOSED to empty on anything unexpected, so a corrupt store never throws into
 * a request.
 */

import type { StorageLike } from "../auth/deviceStore.ts";
import { todayEpochDay } from "../core/clock.ts";

const KEY = "sti.groupjoins.v1";

/** One pending join request: the opaque public join-pointer id, the handle it was
 * made under (for display), and the UTC epoch day it was made. */
export interface PendingJoin {
  readonly pointerId: string;
  readonly handle: string;
  readonly at: number;
}

export interface GroupJoinStore {
  /** Record (or refresh) a request to join `pointerId`, moving it to the front. */
  addPending(pointerId: string, handle: string, at?: number): void;
  /** The current pending join requests, newest first. */
  listPending(): PendingJoin[];
  /** Forget one pending join by pointer id (e.g. after it was redeemed). */
  removePending(pointerId: string): void;
  /** Hide a request from future reviews (an admin rejected it). */
  dismiss(groupId: string, requesterHash: string): void;
  /** Whether the admin has dismissed this request. */
  isDismissed(groupId: string, requesterHash: string): boolean;
  /** Forget everything (e.g. on logout from a shared device). */
  clear(): void;
}

interface Stored {
  readonly pending: PendingJoin[];
  readonly dismissed: string[];
}

function isPendingJoin(v: unknown): v is PendingJoin {
  if (typeof v !== "object" || v === null) return false;
  const o = v as { pointerId?: unknown; handle?: unknown; at?: unknown };
  return (
    typeof o.pointerId === "string" &&
    typeof o.handle === "string" &&
    typeof o.at === "number"
  );
}

// Length-prefix the framing (like requesterHash) so a dismissed key is unambiguous
// regardless of what a component holds: distinct (groupId, requesterHash) pairs can
// never collide even if a value contains the separator.
function dismissKey(groupId: string, requesterHash: string): string {
  return `${groupId.length}:${groupId}:${requesterHash}`;
}

// Read the persisted state, fail-closed to empty on anything unexpected (absent,
// non-JSON, wrong shape), so a corrupt store never throws into a request.
function load(storage: StorageLike): Stored {
  try {
    const raw = storage.getItem(KEY);
    if (raw === null || raw.length === 0) return { pending: [], dismissed: [] };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return { pending: [], dismissed: [] };
    }
    const o = parsed as { pending?: unknown; dismissed?: unknown };
    return {
      pending: Array.isArray(o.pending) ? o.pending.filter(isPendingJoin) : [],
      dismissed: Array.isArray(o.dismissed)
        ? o.dismissed.filter((d): d is string => typeof d === "string")
        : [],
    };
  } catch {
    return { pending: [], dismissed: [] };
  }
}

function save(storage: StorageLike, state: Stored): void {
  try {
    storage.setItem(KEY, JSON.stringify(state));
  } catch {
    // A full / unavailable store just means no cross-session persistence; the
    // in-memory caller still works for this session.
  }
}

export function createGroupJoinStore(storage: StorageLike): GroupJoinStore {
  return {
    addPending(pointerId, handle, at = todayEpochDay()) {
      const state = load(storage);
      // Dedupe by pointer id and move to the front, so re-asking refreshes recency
      // rather than stacking a duplicate row.
      save(storage, {
        ...state,
        pending: [
          { pointerId, handle, at },
          ...state.pending.filter((p) => p.pointerId !== pointerId),
        ],
      });
    },
    listPending() {
      return load(storage).pending;
    },
    removePending(pointerId) {
      const state = load(storage);
      save(storage, {
        ...state,
        pending: state.pending.filter((p) => p.pointerId !== pointerId),
      });
    },
    dismiss(groupId, requesterHash) {
      const state = load(storage);
      const key = dismissKey(groupId, requesterHash);
      if (state.dismissed.includes(key)) return;
      save(storage, { ...state, dismissed: [...state.dismissed, key] });
    },
    isDismissed(groupId, requesterHash) {
      return load(storage).dismissed.includes(
        dismissKey(groupId, requesterHash),
      );
    },
    clear() {
      storage.removeItem(KEY);
    },
  };
}

function memory(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

/**
 * A group-join store backed by window.localStorage, or a volatile in-memory one
 * when localStorage is unavailable (SSR / private mode that throws). Volatile still
 * works within a session; it only loses the lists across reloads.
 */
export function browserGroupJoinStore(): GroupJoinStore {
  try {
    if (typeof localStorage === "undefined")
      return createGroupJoinStore(memory());
    localStorage.getItem(KEY); // some browsers throw on access, not definition
    return createGroupJoinStore(localStorage);
  } catch {
    return createGroupJoinStore(memory());
  }
}

/**
 * Forget the device-local group-join state (e.g. on logout from a shared device),
 * so the next person cannot see which groups this one asked to join or dismissed.
 * Best-effort: an unavailable store has nothing persisted to forget.
 */
export function browserForgetGroupJoins(): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(KEY);
  } catch {
    // Storage unavailable (private mode / SSR): nothing was persisted.
  }
}

/**
 * The viewer's device-local list of access requests they've made (doc 13/16): the
 * aliases this device knocked on but can't yet read. It exists so a logged-out
 * viewer has a way back. The grant key and requester secret already persist
 * (grantKeyStore, requesterStore) and PublicResolutionScreen redeems on mount, so
 * a granted status resolves silently on the viewer's next visit, but only if they
 * reopen that exact link. This list is that "next visit" surface for a viewer who
 * didn't keep the link.
 *
 * It is NOT an identity and never leaves the device: it holds opaque alias ids the
 * viewer already has (from the link they opened) plus the day they asked, for
 * ordering and a recency label. Like faves it is purely local, never in the synced
 * blob, so it adds no server-visible data and simply does not follow a recovery
 * onto a new device. Storage is injected (StorageLike) so it is unit-testable in
 * memory.
 */

import type { StorageLike } from "../auth/deviceStore.ts";
import { todayEpochDay } from "../core/clock.ts";

const KEY = "sti.pending.v1";

/** One pending request: the opaque alias id and the UTC epoch day it was made. */
export interface PendingKnock {
  id: string;
  at: number;
}

export interface PendingKnockStore {
  /** Record (or refresh) a request for `aliasId`, moving it to the front. */
  add(aliasId: string, at?: number): void;
  /** The current requests, newest first. */
  list(): PendingKnock[];
  /** Forget one request by alias id (e.g. the viewer dismissed it). */
  remove(aliasId: string): void;
  /** Forget every request (e.g. on logout from a shared device). */
  clear(): void;
}

function isPending(v: unknown): v is PendingKnock {
  if (typeof v !== "object" || v === null) return false;
  const o = v as { id?: unknown; at?: unknown };
  return typeof o.id === "string" && typeof o.at === "number";
}

// Read the persisted list, fail-closed to empty on anything unexpected (absent,
// non-JSON, wrong shape), so a corrupt store never throws into a knock.
function load(storage: StorageLike): PendingKnock[] {
  try {
    const raw = storage.getItem(KEY);
    if (raw === null || raw.length === 0) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPending);
  } catch {
    return [];
  }
}

function save(storage: StorageLike, list: PendingKnock[]): void {
  try {
    storage.setItem(KEY, JSON.stringify(list));
  } catch {
    // A full / unavailable store just means no cross-session persistence; the
    // in-memory caller still works for this session.
  }
}

export function createPendingKnockStore(
  storage: StorageLike,
): PendingKnockStore {
  return {
    add(aliasId, at = todayEpochDay()) {
      // Dedupe by id and move to the front, so re-asking refreshes recency rather
      // than stacking a duplicate row.
      const next = [
        { id: aliasId, at },
        ...load(storage).filter((p) => p.id !== aliasId),
      ];
      save(storage, next);
    },
    list() {
      return load(storage);
    },
    remove(aliasId) {
      save(
        storage,
        load(storage).filter((p) => p.id !== aliasId),
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
 * A pending-requests store backed by window.localStorage, or a volatile in-memory
 * one when localStorage is unavailable (SSR / private mode that throws). Volatile
 * still works within a session; it only loses the list across reloads.
 */
export function browserPendingKnockStore(): PendingKnockStore {
  try {
    if (typeof localStorage === "undefined")
      return createPendingKnockStore(memory());
    localStorage.getItem(KEY); // some browsers throw on access, not definition
    return createPendingKnockStore(localStorage);
  } catch {
    return createPendingKnockStore(memory());
  }
}

/**
 * Forget every persisted pending request (e.g. on logout from a shared device), so
 * the next person on the device cannot see which links this one asked to view.
 * Best-effort: an unavailable store has nothing persisted to forget.
 */
export function browserForgetPendingKnocks(): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(KEY);
  } catch {
    // Storage unavailable (private mode / SSR): nothing was persisted.
  }
}

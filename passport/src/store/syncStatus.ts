/**
 * Tracks, per account, whether this device holds changes the server has not yet
 * received, and when it last backed up (doc 22 slice 4, the "backed up as of"
 * marker). The offline-sync layer flips it; the not-backed-up affordance subscribes.
 *
 * Persisted in localStorage so the marker survives a reload (with a volatile
 * fallback when localStorage is unavailable). The account id is the same opaque,
 * key-derived id the server already stores, so this adds no readable detail at rest;
 * the flag itself reveals only "this device has unsynced edits".
 */
import type { StorageLike } from "../auth/deviceStore.ts";

export interface SyncSnapshot {
  /** True when local edits have not been pushed to the server yet. */
  readonly pending: boolean;
  /** Epoch ms of the last successful backup, or null if never. */
  readonly lastSyncedAt: number | null;
  /**
   * The server version this device last synced with (doc 22 S8): the base for the
   * optimistic-concurrency precondition on the next push, and the common ancestor
   * for a conflict merge. Null until the first load/push records one.
   */
  readonly version: string | null;
}

export interface SyncStatus {
  snapshot(accountId: string): SyncSnapshot;
  /** Record a successful backup: clears pending, stamps the time and server version. */
  markSynced(accountId: string, at: number, version: string): void;
  markPending(accountId: string): void;
  /**
   * Record the server version this device is now in sync with, WITHOUT changing the
   * pending flag or the backed-up time (used after a clean server load, doc 22 S8).
   */
  setVersion(accountId: string, version: string): void;
  /** Subscribe to any change; returns an unsubscribe. */
  subscribe(listener: () => void): () => void;
}

const STORAGE_KEY = "sti-sync-status";
const SYNCED: SyncSnapshot = {
  pending: false,
  lastSyncedAt: null,
  version: null,
};

// A persisted row may predate a field (e.g. an entry written before `version`
// existed), so entries are read as partial and normalized on read.
type Table = Record<string, Partial<SyncSnapshot>>;

function readTable(storage: StorageLike): Table {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return {};
  try {
    return JSON.parse(raw) as Table;
  } catch {
    return {};
  }
}

export function createSyncStatus(storage: StorageLike): SyncStatus {
  const listeners = new Set<() => void>();
  const notify = (): void => {
    for (const listener of listeners) listener();
  };
  const write = (table: Table): void => {
    storage.setItem(STORAGE_KEY, JSON.stringify(table));
    notify();
  };

  // Normalize a stored row, defaulting fields a pre-version entry lacks, so the
  // snapshot always has a concrete `version` (null when never synced).
  const read = (accountId: string): SyncSnapshot => {
    const s = readTable(storage)[accountId];
    if (s === undefined) return SYNCED;
    return {
      pending: s.pending ?? false,
      lastSyncedAt: s.lastSyncedAt ?? null,
      version: s.version ?? null,
    };
  };

  return {
    snapshot: read,
    markSynced(accountId, at, version) {
      const table = readTable(storage);
      table[accountId] = { pending: false, lastSyncedAt: at, version };
      write(table);
    },
    markPending(accountId) {
      const table = readTable(storage);
      const prev = read(accountId);
      if (prev.pending) return; // already pending; no-op (no spurious notify)
      table[accountId] = {
        pending: true,
        lastSyncedAt: prev.lastSyncedAt,
        version: prev.version,
      };
      write(table);
    },
    setVersion(accountId, version) {
      const prev = read(accountId);
      if (prev.version === version) return; // unchanged; no spurious notify
      const table = readTable(storage);
      table[accountId] = { ...prev, version };
      write(table);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** A volatile, in-memory storage for environments without localStorage. */
export function volatileSyncStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

/**
 * localStorage when available (so the marker survives a reload), else a volatile
 * fallback. Guarded like the other device stores: some private modes define
 * localStorage but throw on access.
 */
export function browserSyncStorage(): StorageLike {
  try {
    if (typeof localStorage === "undefined") return volatileSyncStorage();
    localStorage.getItem(STORAGE_KEY);
    return localStorage;
  } catch {
    return volatileSyncStorage();
  }
}

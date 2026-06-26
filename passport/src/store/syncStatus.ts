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
}

export interface SyncStatus {
  snapshot(accountId: string): SyncSnapshot;
  markSynced(accountId: string, at: number): void;
  markPending(accountId: string): void;
  /** Subscribe to any change; returns an unsubscribe. */
  subscribe(listener: () => void): () => void;
}

const STORAGE_KEY = "sti-sync-status";
const SYNCED: SyncSnapshot = { pending: false, lastSyncedAt: null };

type Table = Record<string, SyncSnapshot>;

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

  return {
    snapshot(accountId) {
      return readTable(storage)[accountId] ?? SYNCED;
    },
    markSynced(accountId, at) {
      const table = readTable(storage);
      table[accountId] = { pending: false, lastSyncedAt: at };
      write(table);
    },
    markPending(accountId) {
      const table = readTable(storage);
      const prev = table[accountId] ?? SYNCED;
      if (prev.pending) return; // already pending; no-op (no spurious notify)
      table[accountId] = { pending: true, lastSyncedAt: prev.lastSyncedAt };
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

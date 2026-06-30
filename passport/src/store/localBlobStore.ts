/**
 * A device-local cache of the owner's account blob, so the app works offline and
 * the device is a real source of truth (doc 22 slice 4). It holds the SAME sealed
 * ciphertext the server stores, keyed by the same opaque account id, so it is no
 * more readable at rest than the encrypted blob already is (the root key never
 * touches this layer). The offline-sync layer reads local-first and writes here
 * before the server, so an offline reload restores the session and an offline edit
 * is durable.
 *
 * IndexedDB-backed, with an in-memory fallback when IndexedDB is unavailable
 * (private mode that throws, or a Node test without a DOM), mirroring how the other
 * device stores degrade rather than crash.
 */

import type { Bytes } from "../crypto/index.ts";

export interface LocalBlobStore {
  /** The sealed blob for an account id, or null if this device has no copy. */
  get(accountId: string): Promise<Bytes | null>;
  /** Cache the sealed blob for an account id (overwrites). */
  put(accountId: string, ciphertext: Bytes): Promise<void>;
  /** Drop this device's copy (on logout / account deletion). */
  remove(accountId: string): Promise<void>;
}

const DB_NAME = "sti-blob";
const STORE = "blob";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"));
  });
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const req = run(transaction.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () =>
          reject(req.error ?? new Error("indexedDB op failed"));
        transaction.oncomplete = () => db.close();
      }),
  );
}

function indexedDbStore(): LocalBlobStore {
  return {
    async get(accountId) {
      const v = await tx<Bytes | undefined>(
        "readonly",
        (store) => store.get(accountId) as IDBRequest<Bytes | undefined>,
      );
      return v ?? null;
    },
    async put(accountId, ciphertext) {
      await tx("readwrite", (store) => store.put(ciphertext, accountId));
    },
    async remove(accountId) {
      await tx("readwrite", (store) => store.delete(accountId));
    },
  };
}

function memoryStore(): LocalBlobStore {
  const map = new Map<string, Bytes>();
  return {
    get: (accountId) => Promise.resolve(map.get(accountId) ?? null),
    put: (accountId, ciphertext) => {
      map.set(accountId, ciphertext);
      return Promise.resolve();
    },
    remove: (accountId) => {
      map.delete(accountId);
      return Promise.resolve();
    },
  };
}

/**
 * The browser-backed local blob store, or an in-memory one when IndexedDB is
 * missing. Reads/writes are still wrapped so a runtime IndexedDB failure (quota,
 * private mode) degrades to a working, if non-durable, session rather than a crash.
 */
export function createLocalBlobStore(): LocalBlobStore {
  if (typeof indexedDB === "undefined") return memoryStore();
  const idb = indexedDbStore();
  const fallback = memoryStore();
  return {
    async get(accountId) {
      try {
        return await idb.get(accountId);
      } catch {
        return fallback.get(accountId);
      }
    },
    async put(accountId, ciphertext) {
      try {
        await idb.put(accountId, ciphertext);
      } catch {
        await fallback.put(accountId, ciphertext);
      }
    },
    async remove(accountId) {
      try {
        await idb.remove(accountId);
      } catch {
        await fallback.remove(accountId);
      }
    },
  };
}

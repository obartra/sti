/**
 * Local persistence of the unlocked master so a reload stays signed in (doc 24).
 * The master is a non-extractable WebCrypto {@link MasterKey}: it can be USED on
 * this device (it derives the account id, blob key, and write token) but can
 * never be exported as raw bytes, so a script that reaches the page can act as
 * the owner while it is open but cannot copy the master out to reuse elsewhere.
 *
 * IndexedDB stores the CryptoKey object directly: structured clone preserves the
 * key (including `extractable: false`), so nothing is ever serialized to bytes.
 * Cleared on logout and on account-delete, so a signed-out or deleted account
 * leaves no resumable key.
 *
 * Reads are fail-closed: any error (unavailable IndexedDB, a corrupt record)
 * returns null, so the owner falls back to the recovery phrase rather than acting
 * on a bad key. The store is null when IndexedDB is unavailable (server render,
 * private mode that throws); a volatile in-memory variant covers tests and that
 * fallback.
 */

import type { MasterKey } from "../crypto/index.ts";

const DB_NAME = "sti";
const STORE_NAME = "masterKey";
const KEY = "v1";

export interface MasterKeyStore {
  /** The stored master key, or null when absent or unreadable (fail-closed). */
  load(): Promise<MasterKey | null>;
  /** Persist the master key for silent resume on the next load. */
  save(key: MasterKey): Promise<void>;
  /** Forget the stored key (logout / account-delete). The phrase still recovers. */
  clear(): Promise<void>;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"));
  });
}

// Run one transaction against the masterKey store and resolve with its result.
// Any error (open, transaction, request) rejects, so callers can fail closed.
function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const req = run(tx.objectStore(STORE_NAME));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () =>
          reject(req.error ?? new Error("idb request failed"));
        tx.oncomplete = () => db.close();
        tx.onabort = () =>
          reject(tx.error ?? new Error("idb transaction aborted"));
      }),
  );
}

/**
 * A master-key store backed by IndexedDB, or null when IndexedDB is unavailable
 * (server render, or a browser that throws on access in private mode). A null
 * return means this device cannot persist the master; the recovery phrase (or an
 * enrolled passkey) remains the way back in.
 */
export function browserMasterKeyStore(): MasterKeyStore | null {
  try {
    if (typeof indexedDB === "undefined") return null;
    return {
      load: () =>
        withStore<MasterKey | undefined>(
          "readonly",
          // IDBObjectStore.get is typed IDBRequest<any>; the store only ever holds
          // a MasterKey at KEY, so narrow it here.
          (s) => s.get(KEY) as IDBRequest<MasterKey | undefined>,
        )
          .then((v) => v ?? null)
          .catch(() => null),
      save: (key) =>
        withStore("readwrite", (s) => s.put(key, KEY)).then(() => undefined),
      clear: () =>
        withStore("readwrite", (s) => s.delete(KEY)).then(() => undefined),
    };
  } catch {
    return null;
  }
}

/**
 * An in-memory master-key store: a single-process stand-in for tests and the
 * fallback when IndexedDB is unavailable. It does not persist across reloads, so
 * a resume from it is scoped to the running tab, matching the IndexedDB store's
 * contract minus durability.
 */
export function createVolatileMasterKeyStore(): MasterKeyStore {
  let held: MasterKey | null = null;
  return {
    load: () => Promise.resolve(held),
    save: (key) => {
      held = key;
      return Promise.resolve();
    },
    clear: () => {
      held = null;
      return Promise.resolve();
    },
  };
}

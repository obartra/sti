/**
 * The push context the service worker reads on a wake: the api base + the owner's
 * per-contact notify inboxes, so the worker can poll+decrypt them in the background
 * (the app, foreground, has these in memory; the worker needs them at rest).
 *
 * Stored in IndexedDB because a service worker cannot read localStorage. This is the
 * deliberate, user-approved trade (doc 13 slice 7): the inbox capabilities live at
 * rest outside the master-encrypted blob so a closed-app push can work. They are
 * lower-sensitivity capabilities (they can read/clear the contentless "pending
 * nudge" bit, never who/what/when); the app writes the set on push-enable and clears
 * it on disable.
 */

import type { NotifyCapability } from "../store/notifyInbox.ts";

export interface PushContext {
  /** The api origin the worker calls (same value as the app's API_BASE_URL). */
  readonly apiBase: string;
  /**
   * The owner's per-contact receiving inboxes (doc 13). One per contact, so a
   * background wake polls them all (any real ping shows the contentless nudge).
   */
  readonly caps: readonly NotifyCapability[];
}

const DB_NAME = "sti-push";
const STORE = "ctx";
const KEY = "context";
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

/** Persist the push context so the worker can read it on a background wake. */
export async function savePushContext(ctx: PushContext): Promise<void> {
  await tx("readwrite", (store) => store.put(ctx, KEY));
}

/** Read the push context, or null when push has not been enabled on this device. */
export async function readPushContext(): Promise<PushContext | null> {
  try {
    const v = await tx<PushContext | undefined>(
      "readonly",
      (store) => store.get(KEY) as IDBRequest<PushContext | undefined>,
    );
    return v ?? null;
  } catch {
    return null;
  }
}

/** Forget the push context (on disable / logout), so the worker stops polling. */
export async function clearPushContext(): Promise<void> {
  await tx("readwrite", (store) => store.delete(KEY));
}

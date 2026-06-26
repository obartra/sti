/**
 * The offline-tolerant account sync (doc 22 slice 4). It wraps the same seal/open
 * the server sync uses, but makes the DEVICE the source of truth:
 *
 *  - load() reads the local blob first, so a reload restores the session offline;
 *    only a device with no local copy (a fresh device, or recovery) falls to the
 *    server, caching what it gets.
 *  - save() writes the sealed blob locally FIRST (durable), then pushes to the
 *    server. A push failure (offline, or a transient error) is NOT fatal: the edit
 *    is kept locally and the account is marked pending for a later drain. When
 *    online, the push is awaited, so the server stays current exactly as before.
 *  - drainBlob() re-pushes a pending blob on reconnect, with the master in hand
 *    (the worker has no key, so the drain runs in the foreground, doc 22 S1).
 *
 * The queue is the master-key-sealed local blob itself, coalesced to its latest
 * value: however many offline edits happen, one push backs them all up.
 */
import type { ApiClient } from "../api/client.ts";
import {
  importAesKey,
  seal,
  open,
  deriveAccountId,
  deriveAccountKey,
  deriveAccountWriteToken,
  type Bytes,
} from "../crypto/index.ts";
import {
  serializeAccountBlob,
  parseAccountBlob,
  type AccountBlob,
} from "./accountBlob.ts";
import type { AccountSync } from "./accountSync.ts";
import type { LocalBlobStore } from "./localBlobStore.ts";
import type { SyncStatus } from "./syncStatus.ts";
import { nowMs } from "../core/clock.ts";

export interface OfflineAccountSync extends AccountSync {
  /** The opaque, key-derived account id, to read its sync snapshot. */
  accountId(master: Bytes): Promise<string>;
  /** Re-push the locally cached blob if it is pending; clears pending on success. */
  drainBlob(master: Bytes): Promise<void>;
}

export function createOfflineAccountSync(
  api: ApiClient,
  local: LocalBlobStore,
  status: SyncStatus,
): OfflineAccountSync {
  const derive = (master: Bytes) =>
    Promise.all([
      deriveAccountId(master),
      deriveAccountKey(master).then(importAesKey),
      deriveAccountWriteToken(master),
    ]);

  return {
    async load(master) {
      const [id, key] = await derive(master);
      const readLocal = async (): Promise<AccountBlob | null> => {
        const ct = await local.get(id);
        return ct === null ? null : parseAccountBlob(await open(key, ct));
      };
      // Unsynced local edits always win, so an offline change is never lost to a
      // read (the device is the source of truth while it holds pending work).
      if (status.snapshot(id).pending) {
        const cached = await readLocal();
        if (cached !== null) return cached;
      }
      // Otherwise prefer the server, so edits from this owner's OTHER devices show
      // up, caching what it returns; fall back to the local copy when the server is
      // unreachable (offline) or has none. This keeps a clean device fresh while a
      // reload still works offline.
      try {
        const got = await api.getAccount(id);
        if (got === null) return await readLocal();
        await local.put(id, got.blob);
        return parseAccountBlob(await open(key, got.blob));
      } catch {
        return await readLocal();
      }
    },

    async save(master, blob) {
      const [id, key, writeToken] = await derive(master);
      const ct = await seal(key, serializeAccountBlob(blob));
      await local.put(id, ct); // durable local source of truth, first
      try {
        await api.putAccount(id, ct, writeToken);
        status.markSynced(id, nowMs());
      } catch {
        status.markPending(id); // offline / transient: drain re-pushes later
      }
    },

    async remove(master) {
      const [id, , writeToken] = await derive(master);
      await local.remove(id);
      await api.deleteAccount(id, writeToken);
    },

    accountId(master) {
      return deriveAccountId(master);
    },

    async drainBlob(master) {
      const [id, , writeToken] = await derive(master);
      if (!status.snapshot(id).pending) return;
      const ct = await local.get(id);
      if (ct === null) return;
      await api.putAccount(id, ct, writeToken); // throws if still offline → stays pending
      status.markSynced(id, nowMs());
    },
  };
}

export type { AccountBlob };

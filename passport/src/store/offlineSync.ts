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
 *
 * Every push carries the optimistic-concurrency precondition (doc 22 S8): the server
 * version this device last synced with. If another device wrote in the meantime the
 * server refuses with a 409, and instead of clobbering we reload the server's copy,
 * 3-way merge our edits onto it over the cached ancestor (blobMerge.ts), and re-push.
 * The ancestor is the last-synced server blob, cached beside the working copy.
 */
import { ApiError, type ApiClient } from "../api/client.ts";
import {
  importAesKey,
  seal,
  open,
  deriveAccountId,
  deriveAccountKey,
  deriveAccountWriteToken,
  type Bytes,
  type MasterKey,
} from "../crypto/index.ts";
import {
  serializeAccountBlob,
  parseAccountBlob,
  type AccountBlob,
} from "./accountBlob.ts";
import { mergeAccountBlobs } from "./blobMerge.ts";
import type { AccountSync } from "./accountSync.ts";
import type { LocalBlobStore } from "./localBlobStore.ts";
import type { SyncStatus } from "./syncStatus.ts";
import { nowMs } from "../core/clock.ts";

export interface OfflineAccountSync extends AccountSync {
  /** The opaque, key-derived account id, to read its sync snapshot. */
  accountId(master: MasterKey): Promise<string>;
  /** Re-push the locally cached blob if it is pending; clears pending on success. */
  drainBlob(master: MasterKey): Promise<void>;
}

// The per-account derivations a push needs, bundled so the helpers stay small.
interface AcctKeys {
  id: string;
  key: CryptoKey;
  writeToken: string;
}

// The ancestor (last-synced server blob) is cached beside the working copy under a
// namespaced key, so a conflict can 3-way merge (base, mine, theirs).
const baseKey = (id: string): string => `${id}:base`;

// The push machinery (precondition + conflict merge), factored out of the sync
// object so it stays small. Closes over the api/local/status the sync was built with.
function createPush(api: ApiClient, local: LocalBlobStore, status: SyncStatus) {
  // A successful push: the pushed blob is now both the working copy and the new
  // ancestor at `version`, and the device is backed up.
  const commitSynced = async (
    id: string,
    ct: Bytes,
    version: string,
  ): Promise<void> => {
    await local.put(baseKey(id), ct);
    status.markSynced(id, nowMs(), version);
  };

  // Resolve a 409: reload the server's current blob, 3-way merge our edits onto it
  // over the cached ancestor, and re-push against the server's version. Without an
  // ancestor (a device that never recorded a base) we fall back to an unconditional
  // overwrite, i.e. the legacy last-write-wins, rather than getting stuck. Any
  // further error (a third concurrent write, or going offline mid-resolution) leaves
  // the account pending so the next reconnect retries from the new state.
  const resolveConflict = async (
    k: AcctKeys,
    mine: AccountBlob,
  ): Promise<void> => {
    try {
      const got = await api.getAccount(k.id);
      if (got === null) {
        // The row was deleted under us: recreate it unconditionally from our copy.
        const ct = await seal(k.key, serializeAccountBlob(mine));
        const { version } = await api.putAccount(k.id, ct, k.writeToken);
        await commitSynced(k.id, ct, version);
        return;
      }
      const theirs = parseAccountBlob(await open(k.key, got.blob));
      const baseCt = await local.get(baseKey(k.id));
      const merged =
        baseCt === null
          ? mine
          : mergeAccountBlobs(
              parseAccountBlob(await open(k.key, baseCt)),
              mine,
              theirs,
            );
      const ct = await seal(k.key, serializeAccountBlob(merged));
      await local.put(k.id, ct); // the merged blob is now this device's working copy
      const { version } = await api.putAccount(
        k.id,
        ct,
        k.writeToken,
        got.version,
      );
      await commitSynced(k.id, ct, version);
    } catch {
      status.markPending(k.id);
    }
  };

  // Push the sealed working blob with the optimistic-concurrency precondition: a
  // clean push commits, a 409 triggers a merge, an offline/transient error stays
  // pending for the next drain.
  return async (k: AcctKeys, blob: AccountBlob, ct: Bytes): Promise<void> => {
    const baseVersion = status.snapshot(k.id).version ?? undefined;
    try {
      const { version } = await api.putAccount(
        k.id,
        ct,
        k.writeToken,
        baseVersion,
      );
      await commitSynced(k.id, ct, version);
    } catch (e) {
      if (e instanceof ApiError && e.kind === "conflict") {
        await resolveConflict(k, blob);
      } else {
        status.markPending(k.id); // offline / transient: drain re-pushes later
      }
    }
  };
}

export function createOfflineAccountSync(
  api: ApiClient,
  local: LocalBlobStore,
  status: SyncStatus,
): OfflineAccountSync {
  const derive = (master: MasterKey) =>
    Promise.all([
      deriveAccountId(master),
      deriveAccountKey(master).then(importAesKey),
      deriveAccountWriteToken(master),
    ]);

  const pushOrQueue = createPush(api, local, status);

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
      // up, caching what it returns as both the working copy AND the ancestor and
      // recording the server version (the base for the next push's precondition).
      // Fall back to the local copy when the server is unreachable (offline) or has
      // none, so a reload still works offline.
      try {
        const got = await api.getAccount(id);
        if (got === null) return await readLocal();
        await local.put(id, got.blob);
        await local.put(baseKey(id), got.blob);
        status.setVersion(id, got.version);
        return parseAccountBlob(await open(key, got.blob));
      } catch {
        return await readLocal();
      }
    },

    async save(master, blob) {
      const [id, key, writeToken] = await derive(master);
      const ct = await seal(key, serializeAccountBlob(blob));
      await local.put(id, ct); // durable local source of truth, first
      await pushOrQueue({ id, key, writeToken }, blob, ct);
    },

    async remove(master) {
      const [id, , writeToken] = await derive(master);
      await local.remove(id);
      await local.remove(baseKey(id));
      await api.deleteAccount(id, writeToken);
    },

    accountId(master) {
      return deriveAccountId(master);
    },

    async drainBlob(master) {
      const [id, key, writeToken] = await derive(master);
      if (!status.snapshot(id).pending) return;
      const ct = await local.get(id);
      if (ct === null) return;
      const blob = parseAccountBlob(await open(key, ct));
      await pushOrQueue({ id, key, writeToken }, blob, ct);
    },
  };
}

export type { AccountBlob };

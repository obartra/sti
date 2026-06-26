// @vitest-environment node
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { masterForTest } from "../test-support/phrase.ts";
import {
  deriveAccountKey,
  importAesKey,
  seal,
  type Bytes,
  type MasterKey,
} from "../crypto/index.ts";
import { INITIAL_OWNER_STATE } from "../core/badge.ts";
import { DEFAULT_AVATAR } from "../lib/avatars.ts";
import { serializeAccountBlob, type AccountBlob } from "./accountBlob.ts";
import type { ApiClient } from "../api/client.ts";
import { createLocalBlobStore } from "./localBlobStore.ts";
import { createSyncStatus, volatileSyncStorage } from "./syncStatus.ts";
import { createOfflineAccountSync } from "./offlineSync.ts";

const BLOB: AccountBlob = {
  handle: "robin",
  aliases: [],
  contacts: [],
  state: INITIAL_OWNER_STATE,
  avatar: DEFAULT_AVATAR,
  sharingMode: "link",
};

function fakeApi() {
  const server = new Map<string, Bytes>();
  const net = { online: true };
  const api = {
    getAccount: (id: string) => {
      const v = server.get(id);
      return Promise.resolve(v ? { blob: v, version: "1" } : null);
    },
    putAccount: (id: string, body: Bytes) => {
      if (!net.online) return Promise.reject(new Error("offline"));
      server.set(id, body);
      return Promise.resolve({ version: "1" });
    },
    deleteAccount: (id: string) => {
      server.delete(id);
      return Promise.resolve();
    },
  } as unknown as ApiClient;
  return { api, net, server };
}

function deleteLocalDb(): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase("sti-blob");
    req.onsuccess = req.onerror = () => resolve();
  });
}

async function master(): Promise<MasterKey> {
  return masterForTest("slice4-offline");
}

describe("offline account sync (slice 4)", () => {
  beforeEach(deleteLocalDb);

  it("online save pushes to the server, caches locally, and marks synced", async () => {
    const { api, server } = fakeApi();
    const status = createSyncStatus(volatileSyncStorage());
    const sync = createOfflineAccountSync(api, createLocalBlobStore(), status);
    const m = await master();

    await sync.save(m, BLOB);
    const id = await sync.accountId(m);

    expect(server.has(id)).toBe(true);
    expect(status.snapshot(id).pending).toBe(false);
    expect(await sync.load(m)).toEqual(BLOB);
  });

  it("offline save keeps the edit locally, marks pending, never throws", async () => {
    const { api, net, server } = fakeApi();
    const status = createSyncStatus(volatileSyncStorage());
    const sync = createOfflineAccountSync(api, createLocalBlobStore(), status);
    const m = await master();
    const id = await sync.accountId(m);

    net.online = false;
    await sync.save(m, BLOB); // must not throw

    expect(server.has(id)).toBe(false); // nothing reached the server
    expect(status.snapshot(id).pending).toBe(true);
    // The edit is still readable offline (device is the source of truth).
    expect(await sync.load(m)).toEqual(BLOB);
  });

  it("drains a pending blob on reconnect and clears pending", async () => {
    const { api, net, server } = fakeApi();
    const status = createSyncStatus(volatileSyncStorage());
    const sync = createOfflineAccountSync(api, createLocalBlobStore(), status);
    const m = await master();
    const id = await sync.accountId(m);

    net.online = false;
    await sync.save(m, BLOB);
    expect(status.snapshot(id).pending).toBe(true);

    net.online = true;
    await sync.drainBlob(m);

    expect(server.has(id)).toBe(true);
    expect(status.snapshot(id).pending).toBe(false);
  });

  it("falls back to the server when this device has no local copy", async () => {
    const { api } = fakeApi();
    const status = createSyncStatus(volatileSyncStorage());
    const m = await master();

    // Seed the server (and a local copy) from one device.
    await createOfflineAccountSync(api, createLocalBlobStore(), status).save(
      m,
      BLOB,
    );
    // Simulate a fresh device: wipe local, then load must reach the server.
    await deleteLocalDb();
    const fresh = createOfflineAccountSync(api, createLocalBlobStore(), status);
    expect(await fresh.load(m)).toEqual(BLOB);
  });

  it("a clean device picks up a server-side change (not its stale local)", async () => {
    const { api, server } = fakeApi();
    const status = createSyncStatus(volatileSyncStorage());
    const sync = createOfflineAccountSync(api, createLocalBlobStore(), status);
    const m = await master();

    await sync.save(m, BLOB); // clean + synced: local and server both hold BLOB
    const id = await sync.accountId(m);

    // Another of the owner's devices updates the server (sealed under the same key).
    const key = await importAesKey(await deriveAccountKey(m));
    const changed: AccountBlob = { ...BLOB, handle: "wren" };
    server.set(id, await seal(key, serializeAccountBlob(changed)));

    // Online and clean: the device must reflect the server's newer value, not the
    // stale local copy (regression guard for the local-first read).
    expect(await sync.load(m)).toEqual(changed);
  });
});

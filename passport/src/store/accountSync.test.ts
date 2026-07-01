// @vitest-environment node
import { describe, it, expect } from "vitest";
import { rootForTest } from "../test-support/phrase.ts";
import { createAccountSync } from "./accountSync.ts";
import type { ApiClient } from "../api/client.ts";
import type { AccountBlob } from "./accountBlob.ts";
import { INITIAL_OWNER_STATE } from "../core/badge.ts";
import { DEFAULT_AVATAR } from "../lib/avatars.ts";
import { type Bytes } from "../crypto/index.ts";

const blob: AccountBlob = {
  handle: "robin",
  aliases: [
    {
      id: "A".repeat(43),
      writeToken: "B".repeat(43),
      key: "C".repeat(43),
      isPublic: true,
    },
  ],
  contacts: [],
  state: INITIAL_OWNER_STATE,
  avatar: DEFAULT_AVATAR,
  sharingMode: "link",
};

// A stateful fake of the account endpoints over a Map; everything else throws.
function fakeAccountApi(): ApiClient {
  const store = new Map<string, { blob: Bytes; version: number }>();
  const unused = () => {
    throw new Error("not used in this test");
  };
  return {
    getAlias: unused,
    putAlias: unused,
    notify: unused,
    republish: unused,
    knockCount: () => Promise.resolve(0),
    knockReview: () => Promise.resolve({ count: 0, pending: [] }),
    getInbox: unused,
    putInbox: unused,
    knock: unused,
    registerPush: unused,
    getVapidPublicKey: unused,
    registerVanityName: unused,
    releaseVanityName: unused,
    resolveVanityName: unused,
    reportVanityName: unused,
    getRecoveryEnvelope: unused,
    putRecoveryEnvelope: unused,
    deleteRecoveryEnvelope: unused,
    health: unused,
    getAccount: (id) => {
      const e = store.get(id);
      return Promise.resolve(
        e ? { blob: e.blob, version: String(e.version) } : null,
      );
    },
    putAccount: (id, body) => {
      const version = (store.get(id)?.version ?? 0) + 1;
      store.set(id, { blob: body, version });
      return Promise.resolve({ version: String(version) });
    },
    deleteAccount: (id) => {
      store.delete(id);
      return Promise.resolve();
    },
  };
}

describe("account sync", () => {
  it("saves and loads the blob for the same root key", async () => {
    const sync = createAccountSync(fakeAccountApi());
    const root = await rootForTest("phrase-a");
    await sync.save(root, blob);
    expect(await sync.load(root)).toEqual(blob);
  });

  it("returns null for a root with no saved account", async () => {
    const sync = createAccountSync(fakeAccountApi());
    const root = await rootForTest("never-saved");
    expect(await sync.load(root)).toBeNull();
  });

  it("a different root derives a different id, so it sees no account (null)", async () => {
    const sync = createAccountSync(fakeAccountApi());
    await sync.save(await rootForTest("phrase-a"), blob);
    const other = await rootForTest("phrase-b");
    expect(await sync.load(other)).toBeNull();
  });

  it("remove deletes the blob so a later load is null (idempotent)", async () => {
    const sync = createAccountSync(fakeAccountApi());
    const root = await rootForTest("phrase-a");
    await sync.save(root, blob);
    await sync.remove(root);
    expect(await sync.load(root)).toBeNull();
    // Removing again is a no-op, not an error.
    await expect(sync.remove(root)).resolves.toBeUndefined();
  });
});

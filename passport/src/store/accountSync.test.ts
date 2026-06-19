// @vitest-environment node
import { describe, it, expect } from "vitest";
import { createAccountSync } from "./accountSync.ts";
import type { ApiClient } from "../api/client.ts";
import type { AccountBlob } from "./accountBlob.ts";
import { deriveMasterKey, type Bytes } from "../crypto/index.ts";

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
    knock: unused,
    registerPush: unused,
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
  };
}

describe("account sync", () => {
  it("saves and loads the blob for the same master key", async () => {
    const sync = createAccountSync(fakeAccountApi());
    const master = await deriveMasterKey("phrase-a");
    await sync.save(master, blob);
    expect(await sync.load(master)).toEqual(blob);
  });

  it("returns null for a master with no saved account", async () => {
    const sync = createAccountSync(fakeAccountApi());
    const master = await deriveMasterKey("never-saved");
    expect(await sync.load(master)).toBeNull();
  });

  it("a different master derives a different id, so it sees no account (null)", async () => {
    const sync = createAccountSync(fakeAccountApi());
    await sync.save(await deriveMasterKey("phrase-a"), blob);
    const other = await deriveMasterKey("phrase-b");
    expect(await sync.load(other)).toBeNull();
  });
});

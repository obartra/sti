// @vitest-environment node
import { describe, it, expect } from "vitest";
import { createAccountManager } from "./account.ts";
import type { ApiClient } from "../api/client.ts";
import type { AliasRecord } from "./accountBlob.ts";
import { deriveMasterKey, type Bytes } from "../crypto/index.ts";

const record: AliasRecord = {
  id: "A".repeat(43),
  writeToken: "B".repeat(43),
  key: "C".repeat(43),
  isPublic: true,
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

describe("account manager", () => {
  it("creates and recovers an account with the same phrase", async () => {
    const accounts = createAccountManager(fakeAccountApi());
    const created = await accounts.create("robin");
    const recovered = await accounts.recover(created.recoveryPhrase);
    expect(recovered?.blob).toEqual({ handle: "robin", aliases: [] });
  });

  it("appends an alias and reflects it on recovery", async () => {
    const accounts = createAccountManager(fakeAccountApi());
    const created = await accounts.create("robin");
    const next = await accounts.addAlias(created.master, record);
    expect(next.aliases).toEqual([record]);
    const recovered = await accounts.recover(created.recoveryPhrase);
    expect(recovered?.blob.aliases).toEqual([record]);
  });

  it("throws when adding an alias for a key with no account", async () => {
    const accounts = createAccountManager(fakeAccountApi());
    const master = await deriveMasterKey("never-created");
    await expect(accounts.addAlias(master, record)).rejects.toThrow();
  });

  it("rejects an invalid handle rather than create an unrecoverable account", async () => {
    const accounts = createAccountManager(fakeAccountApi());
    await expect(accounts.create("")).rejects.toThrow();
    await expect(accounts.create("x".repeat(65))).rejects.toThrow();
  });

  it("addAlias is idempotent on a repeated record (no duplicate)", async () => {
    const accounts = createAccountManager(fakeAccountApi());
    const created = await accounts.create("robin");
    await accounts.addAlias(created.master, record);
    const next = await accounts.addAlias(created.master, record);
    expect(next.aliases).toEqual([record]); // not two copies
  });
});

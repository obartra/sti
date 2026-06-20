// @vitest-environment node
import { describe, it, expect } from "vitest";
import { createAccountManager } from "./account.ts";
import type { ApiClient } from "../api/client.ts";
import type { AliasRecord } from "./accountBlob.ts";
import { INITIAL_OWNER_STATE } from "../core/badge.ts";
import { DEFAULT_AVATAR } from "../lib/avatars.ts";
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
    expect(recovered?.blob).toEqual({
      handle: "robin",
      aliases: [],
      state: INITIAL_OWNER_STATE,
      avatar: DEFAULT_AVATAR,
      sharingMode: "link",
    });
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

  it("removeAlias drops the record and is idempotent on a missing id", async () => {
    const accounts = createAccountManager(fakeAccountApi());
    const created = await accounts.create("robin");
    await accounts.addAlias(created.master, record);

    const removed = await accounts.removeAlias(created.master, record.id);
    expect(removed.aliases).toEqual([]);
    const recovered = await accounts.recover(created.recoveryPhrase);
    expect(recovered?.blob.aliases).toEqual([]);

    // Removing an already-gone id is a no-op, not an error (retry-safe).
    const again = await accounts.removeAlias(created.master, record.id);
    expect(again.aliases).toEqual([]);
  });

  it("setOwnerState persists the new state", async () => {
    const accounts = createAccountManager(fakeAccountApi());
    const created = await accounts.create("robin");
    const paused = { ...INITIAL_OWNER_STATE, paused: true };
    const next = await accounts.setOwnerState(created.master, paused);
    expect(next.state).toEqual(paused);
    const recovered = await accounts.recover(created.recoveryPhrase);
    expect(recovered?.blob.state).toEqual(paused);
  });

  it("rejects an invalid state instead of bricking the account", async () => {
    const accounts = createAccountManager(fakeAccountApi());
    const created = await accounts.create("robin");
    const bad = { ...INITIAL_OWNER_STATE, hiv: "maybe" } as never;
    await expect(accounts.setOwnerState(created.master, bad)).rejects.toThrow();
  });

  it("setProfile persists avatar + sharing and guards invalid input", async () => {
    const accounts = createAccountManager(fakeAccountApi());
    const created = await accounts.create("robin");
    const avatar = { animal: 1, color: 2, hat: 0, glasses: 1, extra: 0 };
    const next = await accounts.setProfile(created.master, {
      avatar,
      sharingMode: "public",
    });
    expect(next.avatar).toEqual(avatar);
    expect(next.sharingMode).toBe("public");

    // A bad avatar or sharing mode is rejected at write time, not persisted.
    await expect(
      accounts.setProfile(created.master, {
        avatar: { ...avatar, animal: 999 },
        sharingMode: "public",
      }),
    ).rejects.toThrow();
    await expect(
      accounts.setProfile(created.master, {
        avatar,
        sharingMode: "secret" as never,
      }),
    ).rejects.toThrow();
  });

  it("saves state even if a republish fails, and a retry converges", async () => {
    const accountStore = new Map<string, { blob: Bytes; version: number }>();
    const aliasStore = new Map<string, Bytes>();
    let aliasPutsAllowed = false;
    const unused = () => {
      throw new Error("not used");
    };
    const api: ApiClient = {
      getAlias: unused,
      notify: unused,
      knock: unused,
      registerPush: unused,
      health: unused,
      getAccount: (id) => {
        const e = accountStore.get(id);
        return Promise.resolve(
          e ? { blob: e.blob, version: String(e.version) } : null,
        );
      },
      putAccount: (id, body) => {
        const version = (accountStore.get(id)?.version ?? 0) + 1;
        accountStore.set(id, { blob: body, version });
        return Promise.resolve({ version: String(version) });
      },
      putAlias: (id, payload) => {
        if (!aliasPutsAllowed)
          return Promise.reject(new Error("republish down"));
        aliasStore.set(id, payload);
        return Promise.resolve();
      },
    };
    const accounts = createAccountManager(api);
    const created = await accounts.create("robin");
    await accounts.addAlias(created.master, record);
    const paused = { ...INITIAL_OWNER_STATE, paused: true };

    // Republish fails, so setOwnerState rejects, but the state is already saved.
    await expect(
      accounts.setOwnerState(created.master, paused),
    ).rejects.toThrow();
    expect(
      (await accounts.recover(created.recoveryPhrase))?.blob.state,
    ).toEqual(paused);

    // A retry with a working alias write converges (republishes the link).
    aliasPutsAllowed = true;
    await accounts.setOwnerState(created.master, paused);
    expect(aliasStore.has(record.id)).toBe(true);
  });
});

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
    // A no-op so deleteAccount's alias revocation (PUT garbage) succeeds here.
    putAlias: () => Promise.resolve(),
    notify: unused,
    knockCount: () => Promise.resolve(0),
    knockReview: () => Promise.resolve({ count: 0, pending: [] }),
    getInbox: unused,
    putInbox: unused,
    knock: unused,
    registerPush: unused,
    getVapidPublicKey: unused,
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

describe("account manager", () => {
  it("creates and recovers an account with the same phrase", async () => {
    const accounts = createAccountManager(fakeAccountApi());
    const created = await accounts.create("robin");
    const recovered = await accounts.recover(created.recoveryPhrase);
    // myNotify is minted per account (random), so pin the rest and assert recovery
    // sees exactly what was created (myNotify persists, not re-minted).
    const { myNotify, ...rest } = recovered?.blob ?? {};
    expect(rest).toEqual({
      handle: "robin",
      aliases: [],
      contacts: [],
      state: INITIAL_OWNER_STATE,
      avatar: DEFAULT_AVATAR,
      sharingMode: "link",
    });
    expect(myNotify).toEqual(created.blob.myNotify);
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

  const contact = {
    id: "D".repeat(43),
    label: "Sam",
    createdDay: 19_000,
    expiresAt: 19_007,
    alias: {
      id: "E".repeat(43),
      writeToken: "F".repeat(43),
      key: "G".repeat(43),
      isPublic: false,
    },
  };

  it("addContact records a per-contact link; removeContact drops it (both idempotent)", async () => {
    const accounts = createAccountManager(fakeAccountApi());
    const created = await accounts.create("robin");

    const withContact = await accounts.addContact(created.master, contact);
    expect(withContact.contacts).toEqual([contact]);
    // Upsert: re-adding the same id does not duplicate.
    const again = await accounts.addContact(created.master, contact);
    expect(again.contacts).toEqual([contact]);
    expect(
      (await accounts.recover(created.recoveryPhrase))?.blob.contacts,
    ).toEqual([contact]);

    const removed = await accounts.removeContact(created.master, contact.id);
    expect(removed.contacts).toEqual([]);
    // Removing an already-gone id is a no-op.
    const noop = await accounts.removeContact(created.master, contact.id);
    expect(noop.contacts).toEqual([]);
  });

  const CIRCLE = "Z".repeat(43);

  it("upsertCircle normalizes members and upserts by id; removeCircle drops it", async () => {
    const accounts = createAccountManager(fakeAccountApi());
    const created = await accounts.create("robin");
    await accounts.addContact(created.master, contact);

    // A ghost id (no such contact) is dropped and the duplicate deduped.
    const saved = await accounts.upsertCircle(created.master, {
      id: CIRCLE,
      name: "close",
      memberContactIds: [contact.id, "ghost", contact.id],
    });
    expect(saved.circles).toEqual([
      { id: CIRCLE, name: "close", memberContactIds: [contact.id] },
    ]);

    // Upsert by id updates in place, never duplicates.
    const renamed = await accounts.upsertCircle(created.master, {
      id: CIRCLE,
      name: "besties",
      memberContactIds: [contact.id],
    });
    expect(renamed.circles).toEqual([
      { id: CIRCLE, name: "besties", memberContactIds: [contact.id] },
    ]);
    expect(
      (await accounts.recover(created.recoveryPhrase))?.blob.circles,
    ).toEqual([
      { id: CIRCLE, name: "besties", memberContactIds: [contact.id] },
    ]);

    const dropped = await accounts.removeCircle(created.master, CIRCLE);
    expect(dropped.circles).toEqual([]);
  });

  it("removeContact strips the contact from every circle", async () => {
    const accounts = createAccountManager(fakeAccountApi());
    const created = await accounts.create("robin");
    await accounts.addContact(created.master, contact);
    await accounts.upsertCircle(created.master, {
      id: CIRCLE,
      name: "close",
      memberContactIds: [contact.id],
    });

    const after = await accounts.removeContact(created.master, contact.id);
    expect(after.contacts).toEqual([]);
    expect(after.circles).toEqual([
      { id: CIRCLE, name: "close", memberContactIds: [] },
    ]);
  });

  it("setOwnerState revokes + drops expired contacts and keeps live ones", async () => {
    const accounts = createAccountManager(fakeAccountApi());
    const created = await accounts.create("robin");
    const live = {
      id: "L".repeat(43),
      label: "Live",
      createdDay: 1,
      expiresAt: 9_999_999_999_999, // far future (epoch ms, year ~2286)
      alias: {
        id: "1".repeat(43),
        writeToken: "2".repeat(43),
        key: "3".repeat(43),
        isPublic: false,
      },
    };
    const expired = {
      id: "X".repeat(43),
      label: "Old",
      createdDay: 1,
      expiresAt: 1, // long past
      alias: {
        id: "4".repeat(43),
        writeToken: "5".repeat(43),
        key: "6".repeat(43),
        isPublic: false,
      },
    };
    await accounts.addContact(created.master, live);
    await accounts.addContact(created.master, expired);

    const next = await accounts.setOwnerState(created.master, {
      ...INITIAL_OWNER_STATE,
      onPrep: true,
    });
    // The expired link is dropped (and its payload revoked); the live one stays.
    expect(next.contacts.map((c) => c.id)).toEqual([live.id]);
  });

  it("deleteAccount removes the blob so recovery finds nothing", async () => {
    const accounts = createAccountManager(fakeAccountApi());
    const created = await accounts.create("robin");
    await accounts.addAlias(created.master, record);

    await accounts.deleteAccount(created.master);
    // The account is gone: the phrase no longer recovers anything.
    expect(await accounts.recover(created.recoveryPhrase)).toBeNull();
    // Idempotent: deleting again is a no-op, not an error.
    await expect(
      accounts.deleteAccount(created.master),
    ).resolves.toBeUndefined();
  });

  it("deleteAccount leaves the blob intact if an alias revoke fails (retryable)", async () => {
    // The core privacy ordering: revoke every alias FIRST, delete the blob only
    // after. If a revoke fails, the account must survive so a retry can finish,
    // never blob-deleted-but-links-live.
    const accountStore = new Map<string, { blob: Bytes; version: number }>();
    let deleted = false;
    const unused = () => {
      throw new Error("not used");
    };
    const api: ApiClient = {
      getAlias: unused,
      notify: unused,
      knockCount: () => Promise.resolve(0),
      knockReview: () => Promise.resolve({ count: 0, pending: [] }),
      getInbox: unused,
      putInbox: unused,
      knock: unused,
      registerPush: unused,
      getVapidPublicKey: unused,
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
      putAlias: () => Promise.reject(new Error("revoke down")),
      deleteAccount: (id) => {
        deleted = true;
        accountStore.delete(id);
        return Promise.resolve();
      },
    };
    const accounts = createAccountManager(api);
    const created = await accounts.create("robin");
    await accounts.addAlias(created.master, record);

    await expect(accounts.deleteAccount(created.master)).rejects.toThrow();
    expect(deleted).toBe(false); // the blob delete never ran
    expect(await accounts.recover(created.recoveryPhrase)).not.toBeNull();
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
    const avatar = { hair: 1, mood: 2, skin: 2, hairColor: 4, beard: 0 };
    const next = await accounts.setProfile(created.master, {
      avatar,
      sharingMode: "public",
    });
    expect(next.avatar).toEqual(avatar);
    expect(next.sharingMode).toBe("public");

    // A bad avatar or sharing mode is rejected at write time, not persisted.
    await expect(
      accounts.setProfile(created.master, {
        avatar: { ...avatar, hair: 999 },
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
      knockCount: () => Promise.resolve(0),
      knockReview: () => Promise.resolve({ count: 0, pending: [] }),
      getInbox: unused,
      putInbox: unused,
      knock: unused,
      registerPush: unused,
      getVapidPublicKey: unused,
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
      deleteAccount: (id) => {
        accountStore.delete(id);
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

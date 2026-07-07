// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { rootForTest } from "../test-support/phrase.ts";
import { createAccountManager } from "./account.ts";
import { createAccountSync } from "./accountSync.ts";
import type { ApiClient } from "../api/client.ts";
import type { AliasRecord } from "./accountBlob.ts";
import { INITIAL_OWNER_STATE } from "../core/badge.ts";
import { DEFAULT_AVATAR } from "../lib/avatars.ts";
import { type Bytes } from "../crypto/index.ts";

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
    submitFeedback: unused,
    getRecoveryEnvelope: unused,
    putRecoveryEnvelope: unused,
    deleteRecoveryEnvelope: unused,
    getGroupBlob: unused,
    putGroupBlob: unused,
    deleteGroupBlob: unused,
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
    // A fresh account is fully deterministic now (no account-level notify inbox:
    // those are minted per contact at link time), so recovery sees exactly what was
    // created. The phrase is stored in the (encrypted) blob so Settings can re-view
    // it (doc 32); it is the same phrase shown once at sign-up.
    expect(recovered?.blob).toEqual({
      handle: "robin",
      aliases: [],
      contacts: [],
      state: INITIAL_OWNER_STATE,
      avatar: DEFAULT_AVATAR,
      recoveryPhrase: created.recoveryPhrase,
    });
    expect(recovered?.blob).toEqual(created.blob);
  });

  it("sign-up stores the recovery phrase inside the blob (doc 32)", async () => {
    const accounts = createAccountManager(fakeAccountApi());
    const created = await accounts.create("robin");
    expect(created.blob.recoveryPhrase).toBe(created.recoveryPhrase);
  });

  it("backfills the stored phrase on a phrase login when it is absent (doc 32)", async () => {
    // Simulate a pre-feature account: encrypt-and-save a blob with no stored phrase
    // through the same sync the manager uses, then log in by phrase and confirm the
    // phrase is written into the (encrypted) blob. The manager and the seeding sync
    // share one api, so they see the same store.
    const api = fakeAccountApi();
    const sync = createAccountSync(api);
    const accounts = createAccountManager(api, sync);
    const created = await accounts.create("robin");
    const phrase = created.recoveryPhrase;
    const olderBlob = { ...created.blob };
    delete (olderBlob as { recoveryPhrase?: string }).recoveryPhrase;
    await sync.save(created.root, olderBlob);
    // The first phrase login after the strip backfills it.
    const firstLogin = await accounts.recover(phrase);
    expect(firstLogin?.blob.recoveryPhrase).toBe(phrase);
    // And a second login sees it already stored (a no-op, still present).
    const again = await accounts.recover(phrase);
    expect(again?.blob.recoveryPhrase).toBe(phrase);
  });

  it("recover fails closed (null) on a malformed phrase, never deriving a key", async () => {
    const accounts = createAccountManager(fakeAccountApi());
    for (const bad of ["", "hunter2", "not a recovery phrase"]) {
      expect(await accounts.recover(bad)).toBeNull();
    }
  });

  it("appends an alias and reflects it on recovery", async () => {
    const accounts = createAccountManager(fakeAccountApi());
    const created = await accounts.create("robin");
    const next = await accounts.addAlias(created.root, record);
    expect(next.aliases).toEqual([record]);
    const recovered = await accounts.recover(created.recoveryPhrase);
    expect(recovered?.blob.aliases).toEqual([record]);
  });

  it("throws when adding an alias for a key with no account", async () => {
    const accounts = createAccountManager(fakeAccountApi());
    const root = await rootForTest("never-created");
    await expect(accounts.addAlias(root, record)).rejects.toThrow();
  });

  it("rejects an invalid handle rather than create an unrecoverable account", async () => {
    const accounts = createAccountManager(fakeAccountApi());
    await expect(accounts.create("")).rejects.toThrow();
    await expect(accounts.create("x".repeat(65))).rejects.toThrow();
  });

  it("addAlias is idempotent on a repeated record (no duplicate)", async () => {
    const accounts = createAccountManager(fakeAccountApi());
    const created = await accounts.create("robin");
    await accounts.addAlias(created.root, record);
    const next = await accounts.addAlias(created.root, record);
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

    const withContact = await accounts.addContact(created.root, contact);
    expect(withContact.contacts).toEqual([contact]);
    // Upsert: re-adding the same id does not duplicate.
    const again = await accounts.addContact(created.root, contact);
    expect(again.contacts).toEqual([contact]);
    expect(
      (await accounts.recover(created.recoveryPhrase))?.blob.contacts,
    ).toEqual([contact]);

    const removed = await accounts.removeContact(created.root, contact.id);
    expect(removed.contacts).toEqual([]);
    // Removing an already-gone id is a no-op.
    const noop = await accounts.removeContact(created.root, contact.id);
    expect(noop.contacts).toEqual([]);
  });

  const CIRCLE = "Z".repeat(43);

  it("upsertCircle normalizes members and upserts by id; removeCircle drops it", async () => {
    const accounts = createAccountManager(fakeAccountApi());
    const created = await accounts.create("robin");
    await accounts.addContact(created.root, contact);

    // A ghost id (no such contact) is dropped and the duplicate deduped.
    const saved = await accounts.upsertCircle(created.root, {
      id: CIRCLE,
      name: "close",
      memberContactIds: [contact.id, "ghost", contact.id],
    });
    expect(saved.circles).toEqual([
      { id: CIRCLE, name: "close", memberContactIds: [contact.id] },
    ]);

    // Upsert by id updates in place, never duplicates.
    const renamed = await accounts.upsertCircle(created.root, {
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

    const dropped = await accounts.removeCircle(created.root, CIRCLE);
    expect(dropped.circles).toEqual([]);
  });

  it("removeContact strips the contact from every circle", async () => {
    const accounts = createAccountManager(fakeAccountApi());
    const created = await accounts.create("robin");
    await accounts.addContact(created.root, contact);
    await accounts.upsertCircle(created.root, {
      id: CIRCLE,
      name: "close",
      memberContactIds: [contact.id],
    });

    const after = await accounts.removeContact(created.root, contact.id);
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
    await accounts.addContact(created.root, live);
    await accounts.addContact(created.root, expired);

    const next = await accounts.setOwnerState(created.root, {
      ...INITIAL_OWNER_STATE,
      onPrep: true,
    });
    // The expired link is dropped (and its payload revoked); the live one stays.
    expect(next.contacts.map((c) => c.id)).toEqual([live.id]);
  });

  it("deleteAccount removes the blob so recovery finds nothing", async () => {
    const accounts = createAccountManager(fakeAccountApi());
    const created = await accounts.create("robin");
    await accounts.addAlias(created.root, record);

    await accounts.deleteAccount(created.root);
    // The account is gone: the phrase no longer recovers anything.
    expect(await accounts.recover(created.recoveryPhrase)).toBeNull();
    // Idempotent: deleting again is a no-op, not an error.
    await expect(accounts.deleteAccount(created.root)).resolves.toBeUndefined();
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
      submitFeedback: unused,
      getRecoveryEnvelope: unused,
      putRecoveryEnvelope: unused,
      deleteRecoveryEnvelope: unused,
      getGroupBlob: unused,
      putGroupBlob: unused,
      deleteGroupBlob: unused,
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
    await accounts.addAlias(created.root, record);

    await expect(accounts.deleteAccount(created.root)).rejects.toThrow();
    expect(deleted).toBe(false); // the blob delete never ran
    expect(await accounts.recover(created.recoveryPhrase)).not.toBeNull();
  });

  it("removeAlias drops the record and is idempotent on a missing id", async () => {
    const accounts = createAccountManager(fakeAccountApi());
    const created = await accounts.create("robin");
    await accounts.addAlias(created.root, record);

    const removed = await accounts.removeAlias(created.root, record.id);
    expect(removed.aliases).toEqual([]);
    const recovered = await accounts.recover(created.recoveryPhrase);
    expect(recovered?.blob.aliases).toEqual([]);

    // Removing an already-gone id is a no-op, not an error (retry-safe).
    const again = await accounts.removeAlias(created.root, record.id);
    expect(again.aliases).toEqual([]);
  });

  it("setOwnerState persists the new state", async () => {
    const accounts = createAccountManager(fakeAccountApi());
    const created = await accounts.create("robin");
    const paused = { ...INITIAL_OWNER_STATE, paused: true };
    const next = await accounts.setOwnerState(created.root, paused);
    expect(next.state).toEqual(paused);
    const recovered = await accounts.recover(created.recoveryPhrase);
    expect(recovered?.blob.state).toEqual(paused);
  });

  it("rejects an invalid state instead of bricking the account", async () => {
    const accounts = createAccountManager(fakeAccountApi());
    const created = await accounts.create("robin");
    const bad = { ...INITIAL_OWNER_STATE, hiv: "maybe" } as never;
    await expect(accounts.setOwnerState(created.root, bad)).rejects.toThrow();
  });

  it("setProfile persists avatar and guards invalid input", async () => {
    const accounts = createAccountManager(fakeAccountApi());
    const created = await accounts.create("robin");
    const avatar = { hair: 1, mood: 2, skin: 2, hairColor: 4, beard: 0 };
    const next = await accounts.setProfile(created.root, {
      avatar,
    });
    expect(next.avatar).toEqual(avatar);

    // A bad avatar is rejected at write time, not persisted.
    await expect(
      accounts.setProfile(created.root, {
        avatar: { ...avatar, hair: 999 },
      }),
    ).rejects.toThrow();
  });

  it("setProfile edits the local display name: set, clear, and leave-unchanged", async () => {
    const accounts = createAccountManager(fakeAccountApi());
    const created = await accounts.create("robin");
    const avatar = created.blob.avatar;

    // No handle key: the name is left untouched (the avatar-only edit path).
    const kept = await accounts.setProfile(created.root, {
      avatar,
    });
    expect(kept.handle).toBe("robin");

    // A string sets it.
    const renamed = await accounts.setProfile(created.root, {
      avatar,
      handle: "robin2",
    });
    expect(renamed.handle).toBe("robin2");

    // null clears it back to no name, omitting the key (never storing "").
    const cleared = await accounts.setProfile(created.root, {
      avatar,
      handle: null,
    });
    expect(cleared.handle).toBeUndefined();
    expect("handle" in cleared).toBe(false);

    // "" clears it too.
    await accounts.setProfile(created.root, {
      avatar,
      handle: "x",
    });
    const clearedEmpty = await accounts.setProfile(created.root, {
      avatar,
      handle: "",
    });
    expect("handle" in clearedEmpty).toBe(false);

    // An over-long name is normalized to the display-name cap, not rejected: the
    // input already limits length, so a long value is trimmed rather than thrown, and
    // a bad value can never seal fine and then throw on the next parse.
    const capped = await accounts.setProfile(created.root, {
      avatar,
      handle: "x".repeat(65),
    });
    expect(capped.handle).toBe("x".repeat(40));
  });

  it("recordFindable appends names and removeFindable drops one (doc 17 cap 5)", async () => {
    const accounts = createAccountManager(fakeAccountApi());
    const created = await accounts.create("robin");
    const aliasA: AliasRecord = { ...record, id: "A".repeat(43) };
    const aliasB: AliasRecord = { ...record, id: "D".repeat(43) };

    // Two claims append (each records its dedicated alias + registration together).
    const one = await accounts.recordFindable(created.root, aliasA, {
      name: "robin",
      aliasId: aliasA.id,
    });
    expect(one.findables).toEqual([{ name: "robin", aliasId: aliasA.id }]);

    const two = await accounts.recordFindable(created.root, aliasB, {
      name: "wren",
      aliasId: aliasB.id,
    });
    expect(two.findables?.map((f) => f.name)).toEqual(["robin", "wren"]);
    // Both dedicated aliases are recorded so knocks to them are reviewed.
    expect(two.aliases.map((a) => a.id)).toEqual(
      expect.arrayContaining([aliasA.id, aliasB.id]),
    );

    // Removing one leaves the other.
    const dropped = await accounts.removeFindable(created.root, "robin");
    expect(dropped.findables).toEqual([{ name: "wren", aliasId: aliasB.id }]);

    // Removing the last drops the field entirely (omitted, never `findables: []`).
    const empty = await accounts.removeFindable(created.root, "wren");
    expect(empty.findables).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(empty, "findables")).toBe(
      false,
    );
  });

  it("setRecoveryName stamps passwordSetAt on set and clears both on remove (doc 32)", async () => {
    vi.useFakeTimers();
    try {
      const pinned = 1_700_000_000_000;
      vi.setSystemTime(pinned);
      const accounts = createAccountManager(fakeAccountApi());
      const created = await accounts.create("robin");

      // Turning the password on records the name AND the set date (from the injected
      // clock), so the yearly refresh nudge can date the factor across devices.
      const set = await accounts.setRecoveryName(created.root, "robin_backup");
      expect(set.recoveryName).toBe("robin_backup");
      expect(set.passwordSetAt).toBe(pinned);

      // Turning it off drops both, by omission (no dangling `undefined` keys), so a
      // removed factor never leaves a set date behind for the nudge to read.
      const cleared = await accounts.setRecoveryName(created.root, null);
      expect(cleared.recoveryName).toBeUndefined();
      expect(cleared.passwordSetAt).toBeUndefined();
      expect(
        Object.prototype.hasOwnProperty.call(cleared, "passwordSetAt"),
      ).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("saves state without throwing when a republish fails, and a retry converges", async () => {
    const accountStore = new Map<string, { blob: Bytes; version: number }>();
    const aliasStore = new Map<string, Bytes>();
    let aliasPutsAllowed = false;
    const unused = () => {
      throw new Error("not used");
    };
    const api: ApiClient = {
      getAlias: unused,
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
      submitFeedback: unused,
      getRecoveryEnvelope: unused,
      putRecoveryEnvelope: unused,
      deleteRecoveryEnvelope: unused,
      getGroupBlob: unused,
      putGroupBlob: unused,
      deleteGroupBlob: unused,
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
    await accounts.addAlias(created.root, record);
    const paused = { ...INITIAL_OWNER_STATE, paused: true };

    // Republish (putAlias) is down. setOwnerState must NOT throw: the owner-facing
    // "couldn't refresh" error is forbidden (decision 156), so the state is saved
    // locally and left for a retry/drain to republish (doc 22 slice 4).
    await accounts.setOwnerState(created.root, paused);
    expect(
      (await accounts.recover(created.recoveryPhrase))?.blob.state,
    ).toEqual(paused);

    // A retry with a working alias write converges (republishes the link).
    aliasPutsAllowed = true;
    await accounts.setOwnerState(created.root, paused);
    expect(aliasStore.has(record.id)).toBe(true);
  });

  // Regression: if the sweep revokes an expired link but the later republish of a
  // SURVIVOR fails, the durable blob must keep the sweep's pruned result, not
  // resurrect the link whose payload was already revoked.
  it("does not resurrect a swept link when the survivor republish fails", async () => {
    const accountStore = new Map<string, { blob: Bytes; version: number }>();
    const liveAliasId = "1".repeat(43);
    const unused = () => {
      throw new Error("not used");
    };
    const api: ApiClient = {
      ...fakeAccountApi(),
      // Revokes (sweep) land, but the republish of the live contact's alias fails.
      putAlias: (id) =>
        id === liveAliasId
          ? Promise.reject(new Error("republish down"))
          : Promise.resolve(),
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
    };
    void unused;
    const accounts = createAccountManager(api);
    const created = await accounts.create("robin");
    const live = {
      id: "L".repeat(43),
      label: "Live",
      createdDay: 1,
      expiresAt: 9_999_999_999_999,
      alias: {
        id: liveAliasId,
        writeToken: "2".repeat(43),
        key: "3".repeat(43),
        isPublic: false,
      },
    };
    const expired = {
      id: "X".repeat(43),
      label: "Old",
      createdDay: 1,
      expiresAt: 1,
      alias: {
        id: "4".repeat(43),
        writeToken: "5".repeat(43),
        key: "6".repeat(43),
        isPublic: false,
      },
    };
    await accounts.addContact(created.root, live);
    await accounts.addContact(created.root, expired);

    const next = await accounts.setOwnerState(created.root, {
      ...INITIAL_OWNER_STATE,
      paused: true,
    });

    // The expired contact stays dropped (its payload was revoked); only the live one
    // remains, and the change is durable.
    expect(next.contacts.map((c) => c.id)).toEqual([live.id]);
    expect(
      (await accounts.recover(created.recoveryPhrase))?.blob.contacts.map(
        (c) => c.id,
      ),
    ).toEqual([live.id]);
  });
});

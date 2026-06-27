// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { createSessionController, type SessionDeps } from "./session.ts";
import { createDeviceStore, type StorageLike } from "../auth/deviceStore.ts";
import type { PasskeyAuth } from "../auth/passkey.ts";
import type { ApiClient } from "../api/client.ts";
import type { AccountManager } from "./account.ts";
import type { AccountSync } from "./accountSync.ts";
import type { AccountBlob } from "./accountBlob.ts";
import { INITIAL_OWNER_STATE } from "../core/badge.ts";
import { DEFAULT_AVATAR } from "../lib/avatars.ts";
import {
  bytesToBase64url,
  base64urlToBytes,
  randomRecoveryPhrase,
  parseRecoveryPhrase,
  deriveMasterKey,
  importMasterKey,
  deriveAccountId,
  type Bytes,
} from "../crypto/index.ts";
import { createVolatileMasterKeyStore } from "../auth/masterKeyStore.ts";

// An in-memory account backend addressed by deriveAccountId(master), like the
// real accountSync. The master is the phrase-derived non-extractable key (doc 24),
// so a re-imported key (after a passkey unwrap or a store resume) addresses the
// same account, and the enroll/resume round-trip is faithful.
function fakeBackend() {
  const byId = new Map<string, AccountBlob>();
  const accounts: AccountManager = {
    async create(handle) {
      const recoveryPhrase = randomRecoveryPhrase();
      const master = await importMasterKey(
        await deriveMasterKey(recoveryPhrase),
      );
      const blob: AccountBlob = {
        handle,
        aliases: [],
        contacts: [],
        state: INITIAL_OWNER_STATE,
        avatar: DEFAULT_AVATAR,
        sharingMode: "link",
      };
      byId.set(await deriveAccountId(master), blob);
      return { recoveryPhrase, master, blob };
    },
    async recover(phrase) {
      const parsed = parseRecoveryPhrase(phrase);
      if (parsed === null) return null;
      const master = await importMasterKey(await deriveMasterKey(parsed));
      const blob = byId.get(await deriveAccountId(master));
      return blob ? { master, blob } : null;
    },
    addAlias: () => Promise.reject(new Error("unused")),
    removeAlias: () => Promise.reject(new Error("unused")),
    addContact: () => Promise.reject(new Error("unused")),
    removeContact: () => Promise.reject(new Error("unused")),
    upsertCircle: () => Promise.reject(new Error("unused")),
    removeCircle: () => Promise.reject(new Error("unused")),
    deleteAccount: async (master) => {
      byId.delete(await deriveAccountId(master));
    },
    setOwnerState: () => Promise.reject(new Error("unused")),
    setProfile: () => Promise.reject(new Error("unused")),
    setFindable: () => Promise.reject(new Error("unused")),
    recordFindable: () => Promise.reject(new Error("unused")),
    sweepExpiredLinks: async (master) => {
      // No links expire in these tests, so a sweep is a pure read of the blob.
      const blob = byId.get(await deriveAccountId(master));
      if (!blob) throw new Error("no account");
      return blob;
    },
  };
  const sync: AccountSync = {
    load: async (master) => byId.get(await deriveAccountId(master)) ?? null,
    save: async (master, blob) => {
      byId.set(await deriveAccountId(master), blob);
    },
    remove: async (master) => {
      byId.delete(await deriveAccountId(master));
    },
  };
  return { accounts, sync };
}

// The fake authenticator from the passkey contract test: a credential maps to a
// fixed PRF secret, so unlock returns exactly what enroll produced.
function fakePasskey(): PasskeyAuth {
  const prfByCred = new Map<string, Bytes>();
  return {
    available: () => true,
    enroll() {
      const credentialId = crypto.randomUUID();
      const prfOutput = crypto.getRandomValues(new Uint8Array(32));
      prfByCred.set(credentialId, prfOutput);
      return Promise.resolve({ credentialId, prfOutput });
    },
    unlock(credentialId) {
      const prf = prfByCred.get(credentialId);
      return prf
        ? Promise.resolve(prf)
        : Promise.reject(new Error("unknown credential"));
    },
  };
}

function memoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

// The session controller's tested methods never touch the api (only shareLink
// does, covered by the integration test), so a throwing stub is sufficient here.
const stubApi = new Proxy({} as ApiClient, {
  get() {
    return () => {
      throw new Error("api unused in this test");
    };
  },
});

function setup(passkey: PasskeyAuth = fakePasskey()) {
  const { accounts, sync } = fakeBackend();
  const devices = createDeviceStore(memoryStorage());
  const deps: SessionDeps = {
    accounts,
    sync,
    devices,
    passkey,
    keys: createVolatileMasterKeyStore(),
    api: stubApi,
  };
  return { ctl: createSessionController(deps), devices, passkey };
}

describe("session controller", () => {
  it("signUp mints a recoverable account and persists nothing locally", async () => {
    const { ctl, devices } = setup();
    const { session, recoveryPhrase } = await ctl.signUp("robin");
    expect(session.blob.handle).toBe("robin");
    expect(recoveryPhrase.length).toBeGreaterThan(0);
    // No passkey yet: the device holds no binding, so reload needs the phrase.
    expect(devices.load()).toBeNull();
  });

  it("recover returns the same account by phrase", async () => {
    const { ctl } = setup();
    const { session, recoveryPhrase } = await ctl.signUp("robin");
    const recovered = await ctl.recover(recoveryPhrase);
    expect(recovered?.blob).toEqual(session.blob);
    expect(recovered?.master).toEqual(session.master);
  });

  it("recover returns null for an unknown phrase", async () => {
    const { ctl } = setup();
    expect(await ctl.recover(randomRecoveryPhrase())).toBeNull();
  });

  it("enrollPasskey stores only the wrapped master, not the master or phrase", async () => {
    const { ctl, devices } = setup();
    const { recoveryPhrase } = await ctl.signUp("robin");
    await ctl.enrollPasskey(recoveryPhrase, "robin");

    const cred = devices.load();
    expect(cred).not.toBeNull();
    expect(cred?.wrappedMaster).not.toBe(recoveryPhrase);
    // The wrapped master is GCM ciphertext over the 32-byte master, never the
    // plaintext: longer than the master by the IV + tag overhead.
    const wrappedBytes = base64urlToBytes(cred?.wrappedMaster ?? "");
    expect(wrappedBytes.length).toBeGreaterThan(32);
  });

  it("resume fails closed when the stored wrapped master is corrupt, leaving the binding intact", async () => {
    // unlock succeeds (the credential id is real) but the wrapped master is
    // unusable, so the unwrap rejects. Two shapes: not base64url, and valid
    // base64url that is too short to be a GCM payload.
    for (const corrupt of ["!!!", bytesToBase64url(new Uint8Array(4))]) {
      const { ctl, devices } = setup();
      const { recoveryPhrase } = await ctl.signUp("robin");
      await ctl.enrollPasskey(recoveryPhrase, "robin");
      const cred = devices.load();
      expect(cred).not.toBeNull();

      devices.save({
        credentialId: cred?.credentialId ?? "",
        wrappedMaster: corrupt,
      });
      expect(await ctl.resume()).toBeNull();
      // The corrupt binding is left in place (not silently wiped); the owner
      // recovers via the phrase.
      expect(devices.load()?.wrappedMaster).toBe(corrupt);
    }
  });

  it("resume after enroll unlocks the same session", async () => {
    const { ctl } = setup();
    const { session, recoveryPhrase } = await ctl.signUp("robin");
    await ctl.enrollPasskey(recoveryPhrase, "robin");

    const resumed = await ctl.resume();
    expect(resumed?.master).toEqual(session.master);
    expect(resumed?.blob).toEqual(session.blob);
  });

  it("resume returns null when no passkey is enrolled", async () => {
    const { ctl } = setup();
    await ctl.signUp("robin");
    expect(await ctl.resume()).toBeNull();
  });

  it("resume returns null when the passkey cannot be read, leaving the binding intact", async () => {
    // Enroll with one authenticator, then resume against a different one that
    // does not know the credential: unlock rejects, resume falls back to null.
    const { accounts, sync } = fakeBackend();
    const devices = createDeviceStore(memoryStorage());
    const enrolled = fakePasskey();
    const ctlA = createSessionController({
      accounts,
      sync,
      devices,
      passkey: enrolled,
      keys: createVolatileMasterKeyStore(),
      api: stubApi,
    });
    const { session, recoveryPhrase } = await ctlA.signUp("robin");
    await ctlA.enrollPasskey(recoveryPhrase, "robin");

    const ctlB = createSessionController({
      accounts,
      sync,
      devices,
      passkey: fakePasskey(),
      keys: createVolatileMasterKeyStore(),
      api: stubApi,
    });
    expect(await ctlB.resume()).toBeNull();
    // The binding is untouched: the original passkey still resumes.
    expect((await ctlA.resume())?.blob).toEqual(session.blob);
  });

  it("resume returns null when the passkey returns a wrong PRF output (fails closed at unwrap)", async () => {
    // unlock succeeds but yields a different PRF than enroll, so GCM rejects.
    const drifting: PasskeyAuth = {
      available: () => true,
      enroll() {
        return Promise.resolve({
          credentialId: "fixed",
          prfOutput: crypto.getRandomValues(new Uint8Array(32)),
        });
      },
      unlock() {
        return Promise.resolve(crypto.getRandomValues(new Uint8Array(32)));
      },
    };
    const { ctl } = setup(drifting);
    const { recoveryPhrase } = await ctl.signUp("robin");
    await ctl.enrollPasskey(recoveryPhrase, "robin");
    expect(await ctl.resume()).toBeNull();
  });

  it("forget removes the binding so resume falls back to the phrase", async () => {
    const { ctl } = setup();
    const { recoveryPhrase } = await ctl.signUp("robin");
    await ctl.enrollPasskey(recoveryPhrase, "robin");
    expect(await ctl.resume()).not.toBeNull();

    ctl.forget();
    expect(await ctl.resume()).toBeNull();
  });

  it("deleteAccount removes the account AND forgets the device binding", async () => {
    const { ctl } = setup();
    const { session, recoveryPhrase } = await ctl.signUp("robin");
    await ctl.enrollPasskey(recoveryPhrase, "robin");
    expect(await ctl.resume()).not.toBeNull();

    await ctl.deleteAccount(session);
    // The blob is gone (phrase recovers nothing) and the passkey can't resume.
    expect(await ctl.recover(recoveryPhrase)).toBeNull();
    expect(await ctl.resume()).toBeNull();
  });

  it("deleteAccount releases a claimed findable name first (best-effort)", async () => {
    const { accounts, sync } = fakeBackend();
    const devices = createDeviceStore(memoryStorage());
    let released: [string, string] | null = null;
    // Records the one api call deleteAccount makes for findable; anything else throws.
    const api = new Proxy({} as ApiClient, {
      get(_t, prop) {
        if (prop === "releaseVanityName") {
          return (name: string, writeToken: string) => {
            released = [name, writeToken];
            return Promise.resolve();
          };
        }
        return () => {
          throw new Error("api unused in this test");
        };
      },
    });
    const ctl = createSessionController({
      accounts,
      sync,
      devices,
      passkey: fakePasskey(),
      keys: createVolatileMasterKeyStore(),
      api,
    });
    const { session } = await ctl.signUp("robin");
    const alias = {
      id: "A".repeat(43),
      writeToken: "B".repeat(43),
      key: "C".repeat(43),
      isPublic: true,
    };
    const claimed = {
      master: session.master,
      blob: {
        ...session.blob,
        aliases: [alias],
        findable: { name: "robin", aliasId: alias.id },
      },
    };

    await ctl.deleteAccount(claimed);

    // The name was released with the backing alias's write token, then the account
    // removed (phrase recovers nothing).
    expect(released).toEqual(["robin", "B".repeat(43)]);
    expect(await ctl.recover("ignored")).toBeNull();
  });

  it("deleteAccount leaves no resumable key: clears the key store AND the device binding (doc 24, G15)", async () => {
    // A deleted account must not stay resumable. The recover/resume coverage above
    // proves the effect end-to-end; this pins the mechanism so a refactor that drops
    // either clear (the persisted master key, or the on-device binding) fails here.
    const { accounts, sync } = fakeBackend();
    const devices = createDeviceStore(memoryStorage());
    const keys = createVolatileMasterKeyStore();
    const keysClear = vi.spyOn(keys, "clear");
    const devicesClear = vi.spyOn(devices, "clear");
    const ctl = createSessionController({
      accounts,
      sync,
      devices,
      passkey: fakePasskey(),
      keys,
      api: stubApi,
    });
    const { session } = await ctl.signUp("robin");

    await ctl.deleteAccount(session);

    expect(keysClear).toHaveBeenCalled();
    expect(devicesClear).toHaveBeenCalled();
  });

  it("deleteAccount wipes the resumable key even when the server delete fails (doc 24, G15)", async () => {
    // A transient backend error mid-delete (e.g. a network blip during revoke-all)
    // must not leave a usable master persisted on this device, or a reload would
    // silently resume into an account the owner believes they deleted. The local
    // wipe is independent of the network outcome.
    const { accounts, sync } = fakeBackend();
    accounts.deleteAccount = () =>
      Promise.reject(new Error("network blip mid-delete"));
    const devices = createDeviceStore(memoryStorage());
    const keys = createVolatileMasterKeyStore();
    const keysClear = vi.spyOn(keys, "clear");
    const devicesClear = vi.spyOn(devices, "clear");
    const ctl = createSessionController({
      accounts,
      sync,
      devices,
      passkey: fakePasskey(),
      keys,
      api: stubApi,
    });
    const { session } = await ctl.signUp("robin");
    await ctl.rememberDevice(session);

    await expect(ctl.deleteAccount(session)).rejects.toThrow();

    expect(keysClear).toHaveBeenCalled();
    expect(devicesClear).toHaveBeenCalled();
    expect(await keys.load()).toBeNull();
  });
});

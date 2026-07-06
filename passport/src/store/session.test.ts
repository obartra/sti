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
  deriveRootKey,
  importRootKey,
  deriveAccountId,
  type Bytes,
} from "../crypto/index.ts";
import { createVolatileRootKeyStore } from "../auth/rootKeyStore.ts";

// An in-memory account backend addressed by deriveAccountId(root), like the
// real accountSync. The root is the phrase-derived non-extractable key (doc 24),
// so a re-imported key (after a passkey unwrap or a store resume) addresses the
// same account, and the enroll/resume round-trip is faithful.
function fakeBackend() {
  const byId = new Map<string, AccountBlob>();
  const accounts: AccountManager = {
    async create(handle) {
      const recoveryPhrase = randomRecoveryPhrase();
      const root = await importRootKey(await deriveRootKey(recoveryPhrase));
      const blob: AccountBlob = {
        ...(handle !== undefined ? { handle } : {}),
        aliases: [],
        contacts: [],
        state: INITIAL_OWNER_STATE,
        avatar: DEFAULT_AVATAR,
        sharingMode: "link",
        // The phrase is stored in the (encrypted) blob so Settings can re-view it
        // (doc 32), mirroring the real AccountManager.
        recoveryPhrase,
      };
      byId.set(await deriveAccountId(root), blob);
      return { recoveryPhrase, root, blob };
    },
    async recover(phrase) {
      const parsed = parseRecoveryPhrase(phrase);
      if (parsed === null) return null;
      const root = await importRootKey(await deriveRootKey(parsed));
      const blob = byId.get(await deriveAccountId(root));
      return blob ? { root, blob } : null;
    },
    loadByRoot: async (root) => byId.get(await deriveAccountId(root)) ?? null,
    addAlias: () => Promise.reject(new Error("unused")),
    removeAlias: () => Promise.reject(new Error("unused")),
    addContact: () => Promise.reject(new Error("unused")),
    removeContact: () => Promise.reject(new Error("unused")),
    upsertCircle: () => Promise.reject(new Error("unused")),
    removeCircle: () => Promise.reject(new Error("unused")),
    deleteAccount: async (root) => {
      byId.delete(await deriveAccountId(root));
    },
    setOwnerState: () => Promise.reject(new Error("unused")),
    setProfile: () => Promise.reject(new Error("unused")),
    removeFindable: () => Promise.reject(new Error("unused")),
    recordFindable: () => Promise.reject(new Error("unused")),
    recordGroup: () => Promise.reject(new Error("unused")),
    recordJoinedGroup: () => Promise.reject(new Error("unused")),
    recordPendingInvite: () => Promise.reject(new Error("unused")),
    dropPendingInvite: () => Promise.reject(new Error("unused")),
    promoteInviteToMember: () => Promise.reject(new Error("unused")),
    dropGroupMember: () => Promise.reject(new Error("unused")),
    dropGroup: () => Promise.reject(new Error("unused")),
    updateGroupKgCache: () => Promise.reject(new Error("unused")),
    setRecoveryName: () => Promise.reject(new Error("unused")),
    sweepExpiredLinks: async (root) => {
      // No links expire in these tests, so a sweep is a pure read of the blob.
      const blob = byId.get(await deriveAccountId(root));
      if (!blob) throw new Error("no account");
      return blob;
    },
    refreshLiveLinks: () => Promise.resolve(),
  };
  const sync: AccountSync = {
    load: async (root) => byId.get(await deriveAccountId(root)) ?? null,
    save: async (root, blob) => {
      byId.set(await deriveAccountId(root), blob);
    },
    remove: async (root) => {
      byId.delete(await deriveAccountId(root));
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
    keys: createVolatileRootKeyStore(),
    api: stubApi,
  };
  return { ctl: createSessionController(deps), devices, passkey, sync };
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
    expect(recovered?.root).toEqual(session.root);
  });

  it("recover returns null for an unknown phrase", async () => {
    const { ctl } = setup();
    expect(await ctl.recover(randomRecoveryPhrase())).toBeNull();
  });

  it("enrollPasskey stores only the wrapped root, not the root or phrase", async () => {
    const { ctl, devices } = setup();
    const { recoveryPhrase } = await ctl.signUp("robin");
    await ctl.enrollPasskey(recoveryPhrase, "robin");

    const cred = devices.load();
    expect(cred).not.toBeNull();
    expect(cred?.wrappedRoot).not.toBe(recoveryPhrase);
    // The wrapped root is GCM ciphertext over the 32-byte root, never the
    // plaintext: longer than the root by the IV + tag overhead.
    const wrappedBytes = base64urlToBytes(cred?.wrappedRoot ?? "");
    expect(wrappedBytes.length).toBeGreaterThan(32);
  });

  it("resume fails closed when the stored wrapped root is corrupt, leaving the binding intact", async () => {
    // unlock succeeds (the credential id is real) but the wrapped root is
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
        wrappedRoot: corrupt,
      });
      const result = await ctl.resume();
      expect(result).toEqual({ ok: false, reason: "mismatch" });
      // The corrupt binding is left in place (not silently wiped); the owner
      // recovers via the phrase.
      expect(devices.load()?.wrappedRoot).toBe(corrupt);
    }
  });

  it("resume after enroll unlocks the same session", async () => {
    const { ctl } = setup();
    const { session, recoveryPhrase } = await ctl.signUp("robin");
    await ctl.enrollPasskey(recoveryPhrase, "robin");

    const resumed = await ctl.resume();
    expect(resumed.ok).toBe(true);
    if (resumed.ok) {
      expect(resumed.session.root).toEqual(session.root);
      expect(resumed.session.blob).toEqual(session.blob);
    }
  });

  it("signUp stores the phrase in the session blob, and resume preserves it (doc 32)", async () => {
    const { ctl } = setup();
    const { session, recoveryPhrase } = await ctl.signUp("robin");
    expect(session.blob.recoveryPhrase).toBe(recoveryPhrase);
    await ctl.enrollPasskey(recoveryPhrase, "robin");
    const resumed = await ctl.resume();
    expect(resumed.ok).toBe(true);
    if (resumed.ok) {
      expect(resumed.session.blob.recoveryPhrase).toBe(recoveryPhrase);
    }
  });

  it("passkey resume never fabricates a phrase for a passkey-only blob (doc 32)", async () => {
    // A passkey-only account has no stored phrase (it was never seen on this
    // device). Resume must return the blob as-is, absent phrase and all, so the
    // Settings re-view shows its honest fallback rather than a made-up value.
    const { ctl, sync } = setup();
    const { session, recoveryPhrase } = await ctl.signUp("robin");
    await ctl.enrollPasskey(recoveryPhrase, "robin");
    // Strip the stored phrase to model a pre-feature / passkey-only blob.
    const stripped = { ...session.blob };
    delete (stripped as { recoveryPhrase?: string }).recoveryPhrase;
    await sync.save(session.root, stripped);

    const resumed = await ctl.resume();
    expect(resumed.ok).toBe(true);
    if (resumed.ok) {
      expect(resumed.session.blob.recoveryPhrase).toBeUndefined();
    }
  });

  it("passkeyEnrolled reflects whether a binding is saved on this device (doc 32)", async () => {
    const { ctl } = setup();
    const { recoveryPhrase } = await ctl.signUp("robin");
    // No passkey yet: the phrase re-view gate would use the two-step confirm.
    expect(ctl.passkeyEnrolled()).toBe(false);
    await ctl.enrollPasskey(recoveryPhrase, "robin");
    expect(ctl.passkeyEnrolled()).toBe(true);
  });

  it("verifyPasskey is a pure presence gate: true on assertion, and it never disturbs the session (doc 32)", async () => {
    const { ctl, sync } = setup();
    const { session, recoveryPhrase } = await ctl.signUp("robin");
    await ctl.enrollPasskey(recoveryPhrase, "robin");

    // The enrolled authenticator asserts successfully.
    expect(await ctl.verifyPasskey()).toBe(true);
    // The verify unwraps nothing and writes nothing: the stored account blob is
    // untouched, so the live session is undisturbed (a yes/no gate, not a re-unlock).
    expect(await sync.load(session.root)).toEqual(session.blob);
  });

  it("verifyPasskey resolves false with no binding (doc 32)", async () => {
    // No passkey enrolled: a pure local miss, no prompt, resolves false.
    const { ctl } = setup();
    await ctl.signUp("robin");
    expect(ctl.passkeyEnrolled()).toBe(false);
    expect(await ctl.verifyPasskey()).toBe(false);
  });

  it("verifyPasskey resolves false when the assertion rejects (cancelled / unavailable) (doc 32)", async () => {
    // Enroll a real binding with a working authenticator, then present a passkey
    // whose assertion rejects (a cancelled prompt / unknown credential): the gate
    // reports false so the phrase stays hidden with the retry line.
    const { accounts, sync } = fakeBackend();
    const devices = createDeviceStore(memoryStorage());
    const working = fakePasskey();
    const seed = createSessionController({
      accounts,
      sync,
      devices,
      passkey: working,
      keys: createVolatileRootKeyStore(),
      api: stubApi,
    });
    const { recoveryPhrase } = await seed.signUp("robin");
    await seed.enrollPasskey(recoveryPhrase, "robin");

    const rejecting: PasskeyAuth = {
      available: () => true,
      enroll: () => Promise.reject(new Error("unused")),
      unlock: () => Promise.reject(new Error("cancelled")),
    };
    const gate = createSessionController({
      accounts,
      sync,
      devices,
      passkey: rejecting,
      keys: createVolatileRootKeyStore(),
      api: stubApi,
    });
    // The binding is present, but the assertion rejects, so the presence gate is false.
    expect(gate.passkeyEnrolled()).toBe(true);
    expect(await gate.verifyPasskey()).toBe(false);
  });

  it("resume reports no-binding when no passkey is enrolled", async () => {
    const { ctl } = setup();
    await ctl.signUp("robin");
    expect(await ctl.resume()).toEqual({ ok: false, reason: "no-binding" });
  });

  it("resume reports unavailable when the passkey cannot be read, leaving the binding intact", async () => {
    // Enroll with one authenticator, then resume against a different one that
    // does not know the credential: unlock rejects, resume reports the failure.
    const { accounts, sync } = fakeBackend();
    const devices = createDeviceStore(memoryStorage());
    const enrolled = fakePasskey();
    const ctlA = createSessionController({
      accounts,
      sync,
      devices,
      passkey: enrolled,
      keys: createVolatileRootKeyStore(),
      api: stubApi,
    });
    const { session, recoveryPhrase } = await ctlA.signUp("robin");
    await ctlA.enrollPasskey(recoveryPhrase, "robin");

    const ctlB = createSessionController({
      accounts,
      sync,
      devices,
      passkey: fakePasskey(),
      keys: createVolatileRootKeyStore(),
      api: stubApi,
    });
    // The fake rejects with a plain Error (not a PasskeyError), so it maps to
    // the catch-all "unavailable".
    expect(await ctlB.resume()).toEqual({ ok: false, reason: "unavailable" });
    // The binding is untouched: the original passkey still resumes.
    const again = await ctlA.resume();
    expect(again.ok && again.session.blob).toEqual(session.blob);
  });

  it("resume reports mismatch when the passkey returns a wrong PRF output (fails closed at unwrap)", async () => {
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
    expect(await ctl.resume()).toEqual({ ok: false, reason: "mismatch" });
  });

  it("forget removes the binding so resume falls back to the phrase", async () => {
    const { ctl } = setup();
    const { recoveryPhrase } = await ctl.signUp("robin");
    await ctl.enrollPasskey(recoveryPhrase, "robin");
    expect((await ctl.resume()).ok).toBe(true);

    ctl.forget();
    expect(await ctl.resume()).toEqual({ ok: false, reason: "no-binding" });
  });

  it("deleteAccount removes the account AND forgets the device binding", async () => {
    const { ctl } = setup();
    const { session, recoveryPhrase } = await ctl.signUp("robin");
    await ctl.enrollPasskey(recoveryPhrase, "robin");
    expect(await ctl.resume()).not.toBeNull();

    await ctl.deleteAccount(session);
    // The blob is gone (phrase recovers nothing) and the passkey can't resume.
    expect(await ctl.recover(recoveryPhrase)).toBeNull();
    expect(await ctl.resume()).toEqual({ ok: false, reason: "no-binding" });
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
      keys: createVolatileRootKeyStore(),
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
      root: session.root,
      blob: {
        ...session.blob,
        aliases: [alias],
        findables: [{ name: "robin", aliasId: alias.id }],
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
    // either clear (the persisted root key, or the on-device binding) fails here.
    const { accounts, sync } = fakeBackend();
    const devices = createDeviceStore(memoryStorage());
    const keys = createVolatileRootKeyStore();
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
    // must not leave a usable root persisted on this device, or a reload would
    // silently resume into an account the owner believes they deleted. The local
    // wipe is independent of the network outcome.
    const { accounts, sync } = fakeBackend();
    accounts.deleteAccount = () =>
      Promise.reject(new Error("network blip mid-delete"));
    const devices = createDeviceStore(memoryStorage());
    const keys = createVolatileRootKeyStore();
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

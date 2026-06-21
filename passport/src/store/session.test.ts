// @vitest-environment node
import { describe, it, expect } from "vitest";
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
  type Bytes,
} from "../crypto/index.ts";

// An in-memory account backend keyed by the master bytes, standing in for the
// blind store. The session controller treats the master opaquely, so a random
// 32-byte master is faithful here; real crypto covers the wrap/unwrap path.
function fakeBackend() {
  const byMaster = new Map<string, AccountBlob>();
  const phraseToMaster = new Map<string, Bytes>();
  const accounts: AccountManager = {
    create(handle) {
      const recoveryPhrase = randomRecoveryPhrase();
      const master = crypto.getRandomValues(new Uint8Array(32));
      const blob: AccountBlob = {
        handle,
        aliases: [],
        contacts: [],
        state: INITIAL_OWNER_STATE,
        avatar: DEFAULT_AVATAR,
        sharingMode: "link",
      };
      byMaster.set(bytesToBase64url(master), blob);
      phraseToMaster.set(recoveryPhrase, master);
      return Promise.resolve({ recoveryPhrase, master, blob });
    },
    recover(phrase) {
      const master = phraseToMaster.get(phrase);
      if (!master) return Promise.resolve(null);
      const blob = byMaster.get(bytesToBase64url(master));
      return Promise.resolve(blob ? { master, blob } : null);
    },
    addAlias: () => Promise.reject(new Error("unused")),
    removeAlias: () => Promise.reject(new Error("unused")),
    addContact: () => Promise.reject(new Error("unused")),
    removeContact: () => Promise.reject(new Error("unused")),
    upsertCircle: () => Promise.reject(new Error("unused")),
    removeCircle: () => Promise.reject(new Error("unused")),
    deleteAccount: (master) => {
      byMaster.delete(bytesToBase64url(master));
      return Promise.resolve();
    },
    setOwnerState: () => Promise.reject(new Error("unused")),
    setProfile: () => Promise.reject(new Error("unused")),
  };
  const sync: AccountSync = {
    load: (master) =>
      Promise.resolve(byMaster.get(bytesToBase64url(master)) ?? null),
    save: (master, blob) => {
      byMaster.set(bytesToBase64url(master), blob);
      return Promise.resolve();
    },
    remove: (master) => {
      byMaster.delete(bytesToBase64url(master));
      return Promise.resolve();
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
  const deps: SessionDeps = { accounts, sync, devices, passkey, api: stubApi };
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
    const { session, recoveryPhrase } = await ctl.signUp("robin");
    await ctl.enrollPasskey(session, "robin");

    const cred = devices.load();
    expect(cred).not.toBeNull();
    expect(cred?.wrappedMaster).not.toBe(recoveryPhrase);
    // The wrapped master is GCM ciphertext over the master, never the plaintext:
    // the decoded bytes differ from the master and carry the IV+tag overhead.
    const wrappedBytes = base64urlToBytes(cred?.wrappedMaster ?? "");
    expect(wrappedBytes).not.toEqual(session.master);
    expect(wrappedBytes.length).toBeGreaterThan(session.master.length);
  });

  it("resume fails closed when the stored wrapped master is corrupt, leaving the binding intact", async () => {
    // unlock succeeds (the credential id is real) but the wrapped master is
    // unusable, so the unwrap rejects. Two shapes: not base64url, and valid
    // base64url that is too short to be a GCM payload.
    for (const corrupt of ["!!!", bytesToBase64url(new Uint8Array(4))]) {
      const { ctl, devices } = setup();
      const { session } = await ctl.signUp("robin");
      await ctl.enrollPasskey(session, "robin");
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
    const { session } = await ctl.signUp("robin");
    await ctl.enrollPasskey(session, "robin");

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
      api: stubApi,
    });
    const { session } = await ctlA.signUp("robin");
    await ctlA.enrollPasskey(session, "robin");

    const ctlB = createSessionController({
      accounts,
      sync,
      devices,
      passkey: fakePasskey(),
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
    const { session } = await ctl.signUp("robin");
    await ctl.enrollPasskey(session, "robin");
    expect(await ctl.resume()).toBeNull();
  });

  it("forget removes the binding so resume falls back to the phrase", async () => {
    const { ctl } = setup();
    const { session } = await ctl.signUp("robin");
    await ctl.enrollPasskey(session, "robin");
    expect(await ctl.resume()).not.toBeNull();

    ctl.forget();
    expect(await ctl.resume()).toBeNull();
  });

  it("deleteAccount removes the account AND forgets the device binding", async () => {
    const { ctl } = setup();
    const { session, recoveryPhrase } = await ctl.signUp("robin");
    await ctl.enrollPasskey(session, "robin");
    expect(await ctl.resume()).not.toBeNull();

    await ctl.deleteAccount(session);
    // The blob is gone (phrase recovers nothing) and the passkey can't resume.
    expect(await ctl.recover(recoveryPhrase)).toBeNull();
    expect(await ctl.resume()).toBeNull();
  });
});

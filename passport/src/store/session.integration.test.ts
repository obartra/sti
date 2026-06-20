// @vitest-environment node
// The session against a live blind store: sign up (phrase path), enroll a
// passkey, then resume on "reload" by unwrapping the locally-stored binding and
// reloading the real account blob. Proves the reload story round-trips through
// GET/PUT /acct, not just that the wiring compiles.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApiClient } from "../api/client.ts";
import { createAccountManager } from "./account.ts";
import { createAccountSync } from "./accountSync.ts";
import { createBackendStore } from "./backendStore.ts";
import { createSessionController } from "./session.ts";
import { deriveOwnerCard } from "./ownerCard.ts";
import { createDeviceStore, type StorageLike } from "../auth/deviceStore.ts";
import type { PasskeyAuth } from "../auth/passkey.ts";
import { type Bytes } from "../crypto/index.ts";
import type { OwnerState } from "../core/badge.ts";
import { startApi, type Harness } from "../test-support/serverHarness.ts";

// A fixed-PRF fake authenticator (the passkey contract), so unlock re-yields the
// exact PRF output enroll produced. The concrete WebAuthn adapter is browser-only.
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

describe("owner session against a live blind store", () => {
  let harness: Harness | undefined;
  let baseUrl!: string;

  beforeAll(async () => {
    harness = await startApi();
    baseUrl = harness.baseUrl;
  }, 120_000);

  afterAll(() => harness?.stop());

  function controller(
    passkey: PasskeyAuth,
    devices = createDeviceStore(memoryStorage()),
  ) {
    const api = createApiClient(baseUrl);
    return {
      ctl: createSessionController({
        accounts: createAccountManager(api),
        sync: createAccountSync(api),
        devices,
        passkey,
        api,
      }),
      devices,
      api,
    };
  }

  it("sign up -> enroll passkey -> resume reloads the real account", async () => {
    const passkey = fakePasskey();
    const { ctl, devices } = controller(passkey);

    const { session } = await ctl.signUp("robin");
    expect(devices.load()).toBeNull(); // phrase-only until a passkey is enrolled

    await ctl.enrollPasskey(session, "robin");
    expect(devices.load()).not.toBeNull();

    // A reload: the same passkey + the persisted binding reload the account blob
    // through the live server.
    const resumed = await ctl.resume();
    expect(resumed?.master).toEqual(session.master);
    expect(resumed?.blob).toEqual(session.blob);
  });

  it("recovers the same account from the phrase", async () => {
    const { ctl } = controller(fakePasskey());
    const { session, recoveryPhrase } = await ctl.signUp("sam");
    const recovered = await ctl.recover(recoveryPhrase);
    expect(recovered?.master).toEqual(session.master);
    expect(recovered?.blob).toEqual(session.blob);
  });

  it("a foreign passkey cannot resume another device's binding", async () => {
    const devices = createDeviceStore(memoryStorage());
    const { ctl } = controller(fakePasskey(), devices);
    const { session } = await ctl.signUp("kai");
    await ctl.enrollPasskey(session, "kai");

    // A different authenticator over the same stored binding: unlock rejects.
    const { ctl: foreign } = controller(fakePasskey(), devices);
    expect(await foreign.resume()).toBeNull();
  });

  it("setOwnerState persists a reported result that survives recovery", async () => {
    const { ctl } = controller(fakePasskey());
    const { session, recoveryPhrase } = await ctl.signUp("blue");
    const blueState: OwnerState = {
      ...session.blob.state,
      testing: {
        hasEverTested: true,
        lastPanelAgeDays: 0,
        corePanelComplete: true,
        exposedSitesCovered: true,
      },
      onPrep: true,
    };
    const updated = await ctl.setOwnerState(session, blueState);
    expect(updated.blob.state).toEqual(blueState);

    // The new state round-trips through the real /acct endpoint.
    const recovered = await ctl.recover(recoveryPhrase);
    expect(recovered?.blob.state).toEqual(blueState);
  });

  it("shareLink publishes a resolvable alias, reuses it, and republishes the latest card", async () => {
    const { ctl, api } = controller(fakePasskey());
    const store = createBackendStore(api);
    const { session } = await ctl.signUp("ari");

    // First share mints the account's primary alias and records it.
    const first = await ctl.shareLink(session);
    expect(first.session.blob.aliases).toHaveLength(1);
    const record = first.session.blob.aliases[0];
    expect(record).toBeDefined();
    expect(first.url).toContain(`/a/${record?.id}`);

    // The published payload decrypts (via the alias capabilities) to exactly the
    // owner's current card, proving the real seal -> PUT -> GET -> open round-trip.
    const resolved = await store.resolveAlias({
      id: record?.id ?? "",
      key: record?.key ?? "",
    });
    expect(resolved).toEqual(
      deriveOwnerCard(session.blob.state, session.blob.handle),
    );

    // A second share reuses the same alias (one primary link per account) rather
    // than minting another, and the link is stable.
    const second = await ctl.shareLink(first.session);
    expect(second.session.blob.aliases).toHaveLength(1);
    expect(second.url).toBe(first.url);

    // After a state change, sharing republishes the SAME alias so the existing
    // link now resolves to the updated card (republish path, same id/key).
    const blueState: OwnerState = { ...session.blob.state, onPrep: true };
    const moved = await ctl.setOwnerState(second.session, blueState);
    const third = await ctl.shareLink(moved);
    expect(third.url).toBe(first.url);
    const after = await store.resolveAlias({
      id: record?.id ?? "",
      key: record?.key ?? "",
    });
    expect(after).toEqual(deriveOwnerCard(blueState, session.blob.handle));
  });

  it("share link's key-presence tracks the current sharing mode, not the first share", async () => {
    const { ctl } = controller(fakePasskey());
    const created = await ctl.signUp("pat"); // accounts default to link (private)

    // A private link is the bare /a/{id}: the key is never in the URL.
    const linkShare = await ctl.shareLink(created.session);
    expect(linkShare.url).not.toContain("#k=");
    const linkAlias = linkShare.session.blob.aliases[0];
    expect(linkAlias?.isPublic).toBe(false);

    // Switch the account to public, then share: now the link must carry the key
    // in its fragment, and it is a DISTINCT alias (not the private one re-dressed).
    const pub = await ctl.setProfile(linkShare.session, {
      avatar: created.session.blob.avatar,
      sharingMode: "public",
    });
    const pubShare = await ctl.shareLink(pub);
    expect(pubShare.url).toContain("#k=");
    expect(pubShare.session.blob.aliases).toHaveLength(2);
    const pubAlias = pubShare.session.blob.aliases.find((a) => a.isPublic);
    expect(pubAlias?.id).not.toBe(linkAlias?.id);

    // Switching back to private reuses the ORIGINAL private alias (same link),
    // and crucially never surfaces the public alias's key under a private sheet.
    const back = await ctl.setProfile(pubShare.session, {
      avatar: created.session.blob.avatar,
      sharingMode: "link",
    });
    const backShare = await ctl.shareLink(back);
    expect(backShare.url).toBe(linkShare.url);
    expect(backShare.url).not.toContain("#k=");
  });
});

// @vitest-environment node
import { describe, it, expect } from "vitest";
import { createBackendStore } from "./backendStore.ts";
import { createGrantKeyStore } from "./grantKeyStore.ts";
import { serializePublicCard } from "./publicCard.ts";
import { requesterHash } from "./knock.ts";
import type { StorageLike } from "../auth/deviceStore.ts";
import { ApiError, type ApiClient } from "../api/client.ts";
import { ALIAS_PAYLOAD_SIZE } from "../api/contract.ts";
import {
  importAesKey,
  sealToSize,
  bytesToBase64url,
  type Bytes,
} from "../crypto/index.ts";
import type { ResolvedView } from "../ui/public/PublicResolution.tsx";

function memoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

const view: ResolvedView = {
  state: "blue",
  labels: ["hiv"],
  route: "hiv",
  identity: { handle: "robin" },
};

const GOOD_ID = "A".repeat(43);

/** A stub api whose getAlias returns a scripted payload; nothing else is used. */
function stubApi(getAlias: ApiClient["getAlias"]): ApiClient {
  const unused = () => {
    throw new Error("not used in this test");
  };
  return {
    getAlias,
    putAlias: unused,
    getAccount: unused,
    putAccount: unused,
    deleteAccount: unused,
    notify: unused,
    knockCount: () => Promise.resolve(0),
    knockReview: () => Promise.resolve({ count: 0, pending: [] }),
    getInbox: unused,
    putInbox: unused,
    knock: () => Promise.resolve(),
    registerPush: unused,
    getVapidPublicKey: unused,
    registerVanityName: unused,
    releaseVanityName: unused,
    resolveVanityName: unused,
    health: unused,
  };
}

async function sealedFor(
  v: ResolvedView,
): Promise<{ payload: Bytes; key: string }> {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const key = await importAesKey(raw);
  const payload = await sealToSize(
    key,
    serializePublicCard(v),
    ALIAS_PAYLOAD_SIZE,
  );
  return { payload, key: bytesToBase64url(raw) };
}

describe("backend store resolveAlias", () => {
  it("resolves a published card", async () => {
    const { payload, key } = await sealedFor(view);
    const store = createBackendStore(stubApi(() => Promise.resolve(payload)));
    expect(await store.resolveAlias({ id: GOOD_ID, key })).toEqual(view);
  });

  it("returns null for a miss (server returned a decoy)", async () => {
    const decoy = crypto.getRandomValues(new Uint8Array(ALIAS_PAYLOAD_SIZE));
    const { key } = await sealedFor(view);
    const store = createBackendStore(stubApi(() => Promise.resolve(decoy)));
    expect(await store.resolveAlias({ id: GOOD_ID, key })).toBeNull();
  });

  it("returns null when the server is unreachable", async () => {
    const { key } = await sealedFor(view);
    const store = createBackendStore(
      stubApi(() => Promise.reject(new ApiError("unreachable", "down"))),
    );
    expect(await store.resolveAlias({ id: GOOD_ID, key })).toBeNull();
  });

  it("returns null for a malformed key fragment", async () => {
    const { payload } = await sealedFor(view);
    const store = createBackendStore(stubApi(() => Promise.resolve(payload)));
    expect(
      await store.resolveAlias({ id: GOOD_ID, key: "not base64url!" }),
    ).toBeNull();
  });

  it("returns null when the payload is tampered (auth fails)", async () => {
    const { payload, key } = await sealedFor(view);
    payload[payload.length - 1] = (payload[payload.length - 1] ?? 0) ^ 0x01;
    const store = createBackendStore(stubApi(() => Promise.resolve(payload)));
    expect(await store.resolveAlias({ id: GOOD_ID, key })).toBeNull();
  });

  it("returns null when opened with the wrong key", async () => {
    const { payload } = await sealedFor(view);
    const other = bytesToBase64url(crypto.getRandomValues(new Uint8Array(32)));
    const store = createBackendStore(stubApi(() => Promise.resolve(payload)));
    expect(await store.resolveAlias({ id: GOOD_ID, key: other })).toBeNull();
  });
});

describe("backend store knock", () => {
  it("sends the salted hash and the device's grant pubkey, not the secret", async () => {
    const calls: {
      id: string;
      requesterHash: string;
      pubKey?: string | undefined;
    }[] = [];
    const unused = () => {
      throw new Error("not used in this test");
    };
    const api: ApiClient = {
      getAlias: unused,
      putAlias: unused,
      getAccount: unused,
      putAccount: unused,
      deleteAccount: unused,
      notify: unused,
      knockCount: () => Promise.resolve(0),
      knockReview: () => Promise.resolve({ count: 0, pending: [] }),
      getInbox: unused,
      putInbox: unused,
      registerPush: unused,
      getVapidPublicKey: unused,
      registerVanityName: unused,
      releaseVanityName: unused,
      resolveVanityName: unused,
      health: unused,
      knock: (id, hash, pubKey) => {
        calls.push({ id, requesterHash: hash, pubKey });
        return Promise.resolve();
      },
    };
    const secret = "device-secret-xyz";
    const grantKeys = createGrantKeyStore(memoryStorage());
    const store = createBackendStore(api, secret, grantKeys);

    await store.knock(GOOD_ID);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.id).toBe(GOOD_ID);
    // The wire value is the hash, never the raw secret.
    expect(calls[0]?.requesterHash).toBe(await requesterHash(secret, GOOD_ID));
    expect(calls[0]?.requesterHash).not.toContain(secret);
    // The knock carries this device's grant PUBLIC key (the private half stays
    // in the store), so the owner can seal an in-app grant to it.
    expect(calls[0]?.pubKey).toBe(
      (await grantKeys.forAlias(GOOD_ID)).publicKey,
    );
    expect(calls[0]?.pubKey).not.toBe(grantKeys.privateKey(GOOD_ID));
  });

  it("redeemGrant is null before a knock (no stored key)", async () => {
    const unused = () => {
      throw new Error("not used in this test");
    };
    const api: ApiClient = {
      getAlias: unused,
      putAlias: unused,
      getAccount: unused,
      putAccount: unused,
      deleteAccount: unused,
      notify: unused,
      knock: unused,
      knockCount: () => Promise.resolve(0),
      knockReview: () => Promise.resolve({ count: 0, pending: [] }),
      getInbox: unused,
      putInbox: unused,
      registerPush: unused,
      getVapidPublicKey: unused,
      registerVanityName: unused,
      releaseVanityName: unused,
      resolveVanityName: unused,
      health: unused,
    };
    const store = createBackendStore(
      api,
      "s",
      createGrantKeyStore(memoryStorage()),
    );
    expect(await store.redeemGrant(GOOD_ID)).toBeNull();
  });

  it("redeemGrant is null when the grant slot is a decoy / not sealed to us", async () => {
    // This device knocked (so it has a stored key), but the slot it polls is just
    // a 4096-byte decoy (the owner hasn't approved, or it was sealed to someone
    // else). Opening it fails -> the store fails closed to null, indistinguishable
    // from a miss. getAlias is wired to always return a decoy.
    const decoy = crypto.getRandomValues(new Uint8Array(ALIAS_PAYLOAD_SIZE));
    const store = createBackendStore(
      stubApi(() => Promise.resolve(decoy)),
      "s",
      createGrantKeyStore(memoryStorage()),
    );
    await store.knock(GOOD_ID); // mint + store this device's grant key
    expect(await store.redeemGrant(GOOD_ID)).toBeNull();
  });

  it("redeemGrant fails closed to null when the server is unreachable", async () => {
    const store = createBackendStore(
      stubApi(() => Promise.reject(new ApiError("unreachable", "down"))),
      "s",
      createGrantKeyStore(memoryStorage()),
    );
    await store.knock(GOOD_ID);
    expect(await store.redeemGrant(GOOD_ID)).toBeNull();
  });
});

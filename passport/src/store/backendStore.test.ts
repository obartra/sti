// @vitest-environment node
import { describe, it, expect } from "vitest";
import { createBackendStore } from "./backendStore.ts";
import { serializePublicCard } from "./publicCard.ts";
import { requesterHash } from "./knock.ts";
import { ApiError, type ApiClient } from "../api/client.ts";
import { ALIAS_PAYLOAD_SIZE } from "../api/contract.ts";
import {
  importAesKey,
  sealToSize,
  bytesToBase64url,
  type Bytes,
} from "../crypto/index.ts";
import type { ResolvedView } from "../ui/public/PublicResolution.tsx";

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
    knock: unused,
    registerPush: unused,
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
  it("sends the salted per-device hash for the alias, not the secret", async () => {
    const calls: { id: string; requesterHash: string }[] = [];
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
      registerPush: unused,
      health: unused,
      knock: (id, hash) => {
        calls.push({ id, requesterHash: hash });
        return Promise.resolve();
      },
    };
    const secret = "device-secret-xyz";
    const store = createBackendStore(api, secret);

    await store.knock(GOOD_ID);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.id).toBe(GOOD_ID);
    // The wire value is the hash, never the raw secret.
    expect(calls[0]?.requesterHash).toBe(await requesterHash(secret, GOOD_ID));
    expect(calls[0]?.requesterHash).not.toContain(secret);
  });
});

// @vitest-environment node
import { describe, it, expect } from "vitest";
import { createGrantKeyStore } from "./grantKeyStore.ts";
import type { StorageLike } from "../auth/deviceStore.ts";

function memory(seed: Record<string, string> = {}): StorageLike & {
  dump: () => Record<string, string>;
} {
  const map = new Map<string, string>(Object.entries(seed));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    dump: () => Object.fromEntries(map),
  };
}

describe("grant key store", () => {
  it("returns a stable keypair per alias and persists it", async () => {
    const store = createGrantKeyStore(memory());
    const first = await store.forAlias("alias-1");
    expect(first.publicKey).toBeTruthy();
    expect(first.privateKey).toBeTruthy();
    // Same alias -> the same keypair (the server keeps the first key it saw).
    expect(await store.forAlias("alias-1")).toEqual(first);
    // And it survives a fresh store over the same storage.
    expect(store.privateKey("alias-1")).toBe(first.privateKey);
  });

  it("keeps a distinct keypair per alias", async () => {
    const store = createGrantKeyStore(memory());
    const a = await store.forAlias("alias-a");
    const b = await store.forAlias("alias-b");
    expect(a.privateKey).not.toBe(b.privateKey);
    expect(a.publicKey).not.toBe(b.publicKey);
  });

  it("a second store over the same storage reuses the persisted keypair", async () => {
    const storage = memory();
    const made = await createGrantKeyStore(storage).forAlias("alias-1");
    const reopened = createGrantKeyStore(storage);
    expect(await reopened.forAlias("alias-1")).toEqual(made);
  });

  it("privateKey is null for an alias this device never knocked", () => {
    const store = createGrantKeyStore(memory());
    expect(store.privateKey("never")).toBeNull();
  });

  it("fails closed on a corrupt store: mints a fresh keypair instead of throwing", async () => {
    const store = createGrantKeyStore(
      memory({ "sti.grantkeys.v1": "not json" }),
    );
    expect(store.privateKey("alias-1")).toBeNull();
    const kp = await store.forAlias("alias-1");
    expect(kp.privateKey).toBeTruthy();
  });

  it("clear() forgets every stored keypair", async () => {
    const storage = memory();
    const store = createGrantKeyStore(storage);
    await store.forAlias("alias-1");
    await store.forAlias("alias-2");
    store.clear();
    expect(storage.getItem("sti.grantkeys.v1")).toBeNull();
    expect(store.privateKey("alias-1")).toBeNull();
    expect(store.privateKey("alias-2")).toBeNull();
  });

  it("ignores malformed entries but keeps well-formed ones", () => {
    const storage = memory({
      "sti.grantkeys.v1": JSON.stringify({
        good: { publicKey: "pub", privateKey: "priv" },
        bad: { publicKey: 5 },
      }),
    });
    const store = createGrantKeyStore(storage);
    expect(store.privateKey("good")).toBe("priv");
    expect(store.privateKey("bad")).toBeNull();
  });
});

import { describe, it, expect } from "vitest";
import { createVolatileRootKeyStore } from "./rootKeyStore.ts";
import { importRootKey } from "../crypto/index.ts";

// A non-extractable root, as the store only ever holds (doc 24).
function aRootKey() {
  return importRootKey(crypto.getRandomValues(new Uint8Array(32)));
}

describe("createVolatileRootKeyStore", () => {
  it("round-trips a key, and clear() empties it", async () => {
    const store = createVolatileRootKeyStore();
    expect(await store.load()).toBeNull();

    const key = await aRootKey();
    await store.save(key);
    expect(await store.load()).toBe(key);

    await store.clear();
    expect(await store.load()).toBeNull();
  });
});

describe("the persisted root is non-extractable (doc 24)", () => {
  it("derives but can never be exported as raw bytes", async () => {
    const store = createVolatileRootKeyStore();
    await store.save(await aRootKey());
    const loaded = await store.load();
    if (loaded === null) throw new Error("expected a stored key");

    // The whole point: a stored key can be USED on the device but never copied
    // out, so a script that reaches the page cannot exfiltrate the root.
    expect(loaded.extractable).toBe(false);
    await expect(crypto.subtle.exportKey("raw", loaded)).rejects.toThrow();
  });
});

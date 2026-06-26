import { describe, it, expect } from "vitest";
import { createVolatileMasterKeyStore } from "./masterKeyStore.ts";
import { importMasterKey } from "../crypto/index.ts";

// A non-extractable master, as the store only ever holds (doc 24).
function aMasterKey() {
  return importMasterKey(crypto.getRandomValues(new Uint8Array(32)));
}

describe("createVolatileMasterKeyStore", () => {
  it("round-trips a key, and clear() empties it", async () => {
    const store = createVolatileMasterKeyStore();
    expect(await store.load()).toBeNull();

    const key = await aMasterKey();
    await store.save(key);
    expect(await store.load()).toBe(key);

    await store.clear();
    expect(await store.load()).toBeNull();
  });
});

describe("the persisted master is non-extractable (doc 24)", () => {
  it("derives but can never be exported as raw bytes", async () => {
    const store = createVolatileMasterKeyStore();
    await store.save(await aMasterKey());
    const loaded = await store.load();
    if (loaded === null) throw new Error("expected a stored key");

    // The whole point: a stored key can be USED on the device but never copied
    // out, so a script that reaches the page cannot exfiltrate the master.
    expect(loaded.extractable).toBe(false);
    await expect(crypto.subtle.exportKey("raw", loaded)).rejects.toThrow();
  });
});

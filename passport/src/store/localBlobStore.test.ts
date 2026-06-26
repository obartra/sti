// @vitest-environment node
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { createLocalBlobStore } from "./localBlobStore.ts";

const ID = "a".repeat(43);

describe("local blob store (slice 4)", () => {
  beforeEach(async () => {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase("sti-blob");
      req.onsuccess = req.onerror = () => resolve();
    });
  });

  it("returns null before anything is stored", async () => {
    const store = createLocalBlobStore();
    expect(await store.get(ID)).toBeNull();
  });

  it("round-trips a sealed blob and overwrites on re-put", async () => {
    const store = createLocalBlobStore();
    await store.put(ID, new Uint8Array([1, 2, 3]));
    expect(await store.get(ID)).toEqual(new Uint8Array([1, 2, 3]));
    await store.put(ID, new Uint8Array([4, 5]));
    expect(await store.get(ID)).toEqual(new Uint8Array([4, 5]));
  });

  it("persists across store instances (durable), and removes", async () => {
    await createLocalBlobStore().put(ID, new Uint8Array([9]));
    // A fresh instance (a reload) still sees it: the device is the source of truth.
    expect(await createLocalBlobStore().get(ID)).toEqual(new Uint8Array([9]));
    await createLocalBlobStore().remove(ID);
    expect(await createLocalBlobStore().get(ID)).toBeNull();
  });

  it("keys by account id (no cross-account bleed)", async () => {
    const store = createLocalBlobStore();
    await store.put("a".repeat(43), new Uint8Array([1]));
    await store.put("b".repeat(43), new Uint8Array([2]));
    expect(await store.get("a".repeat(43))).toEqual(new Uint8Array([1]));
    expect(await store.get("b".repeat(43))).toEqual(new Uint8Array([2]));
  });
});

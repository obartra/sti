// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  createDeviceStore,
  type DeviceCredential,
  type StorageLike,
} from "./deviceStore.ts";

// An in-memory StorageLike so the store is exercised without a browser. Exposes
// the raw backing map so a test can assert exactly what lands at rest.
function memoryStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

const CRED: DeviceCredential = {
  credentialId: "cred-abc",
  wrappedRoot: "d3JhcHBlZA",
};

describe("device store", () => {
  it("round-trips a saved credential", () => {
    const store = createDeviceStore(memoryStorage());
    store.save(CRED);
    expect(store.load()).toEqual(CRED);
  });

  it("returns null when nothing is stored", () => {
    expect(createDeviceStore(memoryStorage()).load()).toBeNull();
  });

  it("clear forgets the binding", () => {
    const store = createDeviceStore(memoryStorage());
    store.save(CRED);
    store.clear();
    expect(store.load()).toBeNull();
  });

  it("persists exactly the versioned credential, nothing more", () => {
    const mem = memoryStorage();
    createDeviceStore(mem).save(CRED);
    const raw = mem.getItem("sti.device.v1");
    expect(raw).not.toBeNull();
    expect(raw === null ? null : JSON.parse(raw)).toEqual({
      v: 1,
      credentialId: CRED.credentialId,
      wrappedRoot: CRED.wrappedRoot,
    });
  });

  it("fails closed on corrupt JSON", () => {
    const mem = memoryStorage();
    mem.map.set("sti.device.v1", "{not json");
    expect(createDeviceStore(mem).load()).toBeNull();
  });

  it("fails closed on a version mismatch", () => {
    const mem = memoryStorage();
    mem.map.set(
      "sti.device.v1",
      JSON.stringify({ v: 2, credentialId: "x", wrappedRoot: "y" }),
    );
    expect(createDeviceStore(mem).load()).toBeNull();
  });

  it("fails closed on missing or empty fields", () => {
    const mem = memoryStorage();
    for (const bad of [
      { v: 1, credentialId: "x" },
      { v: 1, wrappedRoot: "y" },
      { v: 1, credentialId: "", wrappedRoot: "y" },
      { v: 1, credentialId: "x", wrappedRoot: "" },
      { v: 1, credentialId: 7, wrappedRoot: "y" },
    ]) {
      mem.map.set("sti.device.v1", JSON.stringify(bad));
      expect(createDeviceStore(mem).load()).toBeNull();
    }
  });
});

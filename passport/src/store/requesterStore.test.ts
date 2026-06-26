// @vitest-environment node
import { describe, it, expect } from "vitest";
import { createRequesterStore } from "./requesterStore.ts";
import type { StorageLike } from "../auth/deviceStore.ts";

function memoryStorage(seed?: Record<string, string>): StorageLike {
  const map = new Map<string, string>(Object.entries(seed ?? {}));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

const ID43 = /^[A-Za-z0-9_-]{43}$/;

describe("requester secret store", () => {
  it("generates a 32-byte base64url secret and persists it", () => {
    const storage = memoryStorage();
    const store = createRequesterStore(storage);
    const secret = store.secret();
    expect(secret).toMatch(ID43);
    // It was written through to storage (so a later instance reuses it).
    expect(storage.getItem("sti.requester.v1")).toBe(secret);
  });

  it("is stable across calls and across instances on the same storage", () => {
    const storage = memoryStorage();
    const first = createRequesterStore(storage).secret();
    expect(createRequesterStore(storage).secret()).toBe(first);
    expect(createRequesterStore(storage).secret()).toBe(first);
  });

  it("two devices (separate storage) get distinct secrets", () => {
    const a = createRequesterStore(memoryStorage()).secret();
    const b = createRequesterStore(memoryStorage()).secret();
    expect(a).not.toBe(b);
  });

  it("regenerates when the stored value is empty (fail-open, still anonymous)", () => {
    const storage = memoryStorage({ "sti.requester.v1": "" });
    const secret = createRequesterStore(storage).secret();
    expect(secret).toMatch(ID43);
  });

  it("clear() forgets the secret, so the next call mints a fresh one", () => {
    const storage = memoryStorage();
    const store = createRequesterStore(storage);
    const first = store.secret();
    store.clear();
    expect(storage.getItem("sti.requester.v1")).toBeNull();
    expect(store.secret()).not.toBe(first);
  });
});

import { describe, it, expect } from "vitest";
import type { StorageLike } from "../auth/deviceStore.ts";
import {
  createPendingKnockStore,
  type PendingKnockStore,
} from "./pendingKnockStore.ts";

function memoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

function ids(store: PendingKnockStore): string[] {
  return store.list().map((p) => p.id);
}

describe("pendingKnockStore", () => {
  it("records a request and lists it", () => {
    const store = createPendingKnockStore(memoryStorage());
    store.add("alias-1", 100);
    expect(store.list()).toEqual([{ id: "alias-1", at: 100 }]);
  });

  it("lists newest first", () => {
    const store = createPendingKnockStore(memoryStorage());
    store.add("alias-1", 100);
    store.add("alias-2", 101);
    expect(ids(store)).toEqual(["alias-2", "alias-1"]);
  });

  it("dedupes by id and refreshes recency to the front", () => {
    const store = createPendingKnockStore(memoryStorage());
    store.add("alias-1", 100);
    store.add("alias-2", 101);
    store.add("alias-1", 102);
    expect(store.list()).toEqual([
      { id: "alias-1", at: 102 },
      { id: "alias-2", at: 101 },
    ]);
  });

  it("removes one request without touching the rest", () => {
    const store = createPendingKnockStore(memoryStorage());
    store.add("alias-1", 100);
    store.add("alias-2", 101);
    store.remove("alias-1");
    expect(ids(store)).toEqual(["alias-2"]);
  });

  it("clear forgets everything", () => {
    const store = createPendingKnockStore(memoryStorage());
    store.add("alias-1", 100);
    store.clear();
    expect(store.list()).toEqual([]);
  });

  it("persists across store instances over the same storage", () => {
    const storage = memoryStorage();
    createPendingKnockStore(storage).add("alias-1", 100);
    expect(ids(createPendingKnockStore(storage))).toEqual(["alias-1"]);
  });

  it("fails closed to empty on a corrupt payload", () => {
    const storage = memoryStorage();
    storage.setItem("sti.pending.v1", "not json{");
    expect(createPendingKnockStore(storage).list()).toEqual([]);
  });

  it("drops malformed entries but keeps well-formed ones", () => {
    const storage = memoryStorage();
    storage.setItem(
      "sti.pending.v1",
      JSON.stringify([{ id: "ok", at: 1 }, { id: 5 }, { at: 2 }, null]),
    );
    expect(createPendingKnockStore(storage).list()).toEqual([
      { id: "ok", at: 1 },
    ]);
  });
});

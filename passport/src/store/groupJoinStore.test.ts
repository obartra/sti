import { describe, it, expect } from "vitest";
import type { StorageLike } from "../auth/deviceStore.ts";
import { createGroupJoinStore } from "./groupJoinStore.ts";

function memoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

describe("groupJoinStore (doc 33, slice 4b)", () => {
  it("records a pending join and lists it", () => {
    const store = createGroupJoinStore(memoryStorage());
    store.addPending("pointer-1", "book_club", 100);
    expect(store.listPending()).toEqual([
      { pointerId: "pointer-1", handle: "book_club", at: 100 },
    ]);
  });

  it("dedupes by pointer id and refreshes recency to the front", () => {
    const store = createGroupJoinStore(memoryStorage());
    store.addPending("pointer-1", "book_club", 100);
    store.addPending("pointer-2", "party", 101);
    store.addPending("pointer-1", "book_club", 102);
    expect(store.listPending().map((p) => p.pointerId)).toEqual([
      "pointer-1",
      "pointer-2",
    ]);
    expect(store.listPending()[0]?.at).toBe(102);
  });

  it("removes one pending join without touching the rest", () => {
    const store = createGroupJoinStore(memoryStorage());
    store.addPending("pointer-1", "book_club", 100);
    store.addPending("pointer-2", "party", 101);
    store.removePending("pointer-1");
    expect(store.listPending().map((p) => p.pointerId)).toEqual(["pointer-2"]);
  });

  it("dismisses a request by (groupId, requesterHash) and reports it", () => {
    const store = createGroupJoinStore(memoryStorage());
    expect(store.isDismissed("group-1", "req-1")).toBe(false);
    store.dismiss("group-1", "req-1");
    expect(store.isDismissed("group-1", "req-1")).toBe(true);
    // A different group or requester is not dismissed (no cross-key collision).
    expect(store.isDismissed("group-2", "req-1")).toBe(false);
    expect(store.isDismissed("group-1", "req-2")).toBe(false);
  });

  it("frames the dismiss key so a separator in one component cannot collide", () => {
    const store = createGroupJoinStore(memoryStorage());
    // "a:b" + "c" and "a" + "b:c" would flatten to the same string without framing.
    store.dismiss("a:b", "c");
    expect(store.isDismissed("a", "b:c")).toBe(false);
  });

  it("clear forgets pending joins and dismissals", () => {
    const store = createGroupJoinStore(memoryStorage());
    store.addPending("pointer-1", "book_club", 100);
    store.dismiss("group-1", "req-1");
    store.clear();
    expect(store.listPending()).toEqual([]);
    expect(store.isDismissed("group-1", "req-1")).toBe(false);
  });

  it("persists across store instances over the same storage", () => {
    const storage = memoryStorage();
    createGroupJoinStore(storage).addPending("pointer-1", "book_club", 100);
    expect(
      createGroupJoinStore(storage)
        .listPending()
        .map((p) => p.pointerId),
    ).toEqual(["pointer-1"]);
  });

  it("fails closed to empty on a corrupt payload", () => {
    const storage = memoryStorage();
    storage.setItem("sti.groupjoins.v1", "not json{");
    const store = createGroupJoinStore(storage);
    expect(store.listPending()).toEqual([]);
    expect(store.isDismissed("group-1", "req-1")).toBe(false);
  });

  it("drops malformed pending entries but keeps well-formed ones", () => {
    const storage = memoryStorage();
    storage.setItem(
      "sti.groupjoins.v1",
      JSON.stringify({
        pending: [
          { pointerId: "ok", handle: "h", at: 1 },
          { pointerId: 5 },
          { handle: "x" },
          null,
        ],
        dismissed: ["keep", 7],
      }),
    );
    const store = createGroupJoinStore(storage);
    expect(store.listPending()).toEqual([
      { pointerId: "ok", handle: "h", at: 1 },
    ]);
  });
});

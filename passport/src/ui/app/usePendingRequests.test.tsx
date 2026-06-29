import { renderHook, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { usePendingRequests } from "./usePendingRequests.ts";
import { createPendingKnockStore } from "../../store/index.ts";
import type { StorageLike } from "../../auth/deviceStore.ts";

function memoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

describe("usePendingRequests", () => {
  it("reads the device-local requests, newest first", () => {
    const store = createPendingKnockStore(memoryStorage());
    store.add("a", 1);
    store.add("b", 2);
    const { result } = renderHook(() => usePendingRequests(store));
    expect(result.current.requests.map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("forget drops a request and re-reads", () => {
    const store = createPendingKnockStore(memoryStorage());
    store.add("a", 1);
    store.add("b", 2);
    const { result } = renderHook(() => usePendingRequests(store));
    act(() => result.current.forget("a"));
    expect(result.current.requests.map((r) => r.id)).toEqual(["b"]);
  });
});

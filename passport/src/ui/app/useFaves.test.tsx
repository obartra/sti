import { renderHook, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { useFaves } from "./useFaves.ts";
import type { StorageLike } from "../../auth/deviceStore.ts";

function memory(seed: Record<string, string> = {}): StorageLike {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

describe("useFaves", () => {
  it("toggles a contact's star on and off", () => {
    const { result } = renderHook(() => useFaves(memory()));
    expect(result.current.faves.has("c1")).toBe(false);
    act(() => result.current.toggleFave("c1"));
    expect(result.current.faves.has("c1")).toBe(true);
    act(() => result.current.toggleFave("c1"));
    expect(result.current.faves.has("c1")).toBe(false);
  });

  it("loads existing faves from storage on mount", () => {
    const store = memory({ "sti.faves.v1": JSON.stringify(["a", "b"]) });
    const { result } = renderHook(() => useFaves(store));
    expect([...result.current.faves].sort()).toEqual(["a", "b"]);
  });

  it("persists the toggled set back to storage", () => {
    const store = memory();
    const { result } = renderHook(() => useFaves(store));
    act(() => result.current.toggleFave("x"));
    expect(store.getItem("sti.faves.v1")).toBe(JSON.stringify(["x"]));
  });

  it("ignores corrupt stored data (reads as empty)", () => {
    const store = memory({ "sti.faves.v1": "not json" });
    const { result } = renderHook(() => useFaves(store));
    expect(result.current.faves.size).toBe(0);
  });
});

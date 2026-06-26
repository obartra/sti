import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useReconnectCatchup } from "./useReconnectCatchup.ts";

describe("useReconnectCatchup (Slice 5 reconsidered)", () => {
  it("refreshes on reconnect while active", () => {
    const refresh = vi.fn();
    renderHook(() => useReconnectCatchup(true, refresh));
    expect(refresh).not.toHaveBeenCalled(); // no poll until connectivity returns
    window.dispatchEvent(new Event("online"));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("does nothing when inactive (logged out)", () => {
    const refresh = vi.fn();
    renderHook(() => useReconnectCatchup(false, refresh));
    window.dispatchEvent(new Event("online"));
    expect(refresh).not.toHaveBeenCalled();
  });

  it("stops listening after unmount", () => {
    const refresh = vi.fn();
    const { unmount } = renderHook(() => useReconnectCatchup(true, refresh));
    unmount();
    window.dispatchEvent(new Event("online"));
    expect(refresh).not.toHaveBeenCalled();
  });
});

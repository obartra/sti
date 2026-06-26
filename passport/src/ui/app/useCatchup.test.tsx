import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useCatchup } from "./useCatchup.ts";

function setVisible(state: "visible" | "hidden"): void {
  Object.defineProperty(document, "visibilityState", {
    value: state,
    configurable: true,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("useCatchup (Slice 5 reconsidered)", () => {
  beforeEach(() => {
    vi.spyOn(Date, "now").mockReturnValue(1_000_000);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("refreshes on reconnect while active", () => {
    const refresh = vi.fn();
    renderHook(() => useCatchup(true, refresh));
    expect(refresh).not.toHaveBeenCalled(); // no poll until something resumes
    window.dispatchEvent(new Event("online"));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("refreshes when the app returns to the foreground", () => {
    const refresh = vi.fn();
    renderHook(() => useCatchup(true, refresh));
    setVisible("visible");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("throttles rapid resumes but allows a later one", () => {
    const refresh = vi.fn();
    renderHook(() => useCatchup(true, refresh));
    window.dispatchEvent(new Event("online")); // fires
    setVisible("visible"); // within the throttle window: suppressed
    expect(refresh).toHaveBeenCalledTimes(1);
    vi.spyOn(Date, "now").mockReturnValue(1_000_000 + 61_000); // past the window
    window.dispatchEvent(new Event("online"));
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("does nothing when inactive (logged out)", () => {
    const refresh = vi.fn();
    renderHook(() => useCatchup(false, refresh));
    window.dispatchEvent(new Event("online"));
    setVisible("visible");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("stops listening after unmount", () => {
    const refresh = vi.fn();
    const { unmount } = renderHook(() => useCatchup(true, refresh));
    unmount();
    window.dispatchEvent(new Event("online"));
    expect(refresh).not.toHaveBeenCalled();
  });
});

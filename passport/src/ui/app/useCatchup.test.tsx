import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useCatchup } from "./useCatchup.ts";

// Zero the reconnect jitter so the scheduled read runs on the next tick.
vi.mock("../../lib/jitter.ts", () => ({ reconnectJitterMs: () => 0 }));

function setVisible(state: "visible" | "hidden"): void {
  Object.defineProperty(document, "visibilityState", {
    value: state,
    configurable: true,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe("useCatchup (Slice 5 reconsidered)", () => {
  beforeEach(() => {
    vi.spyOn(Date, "now").mockReturnValue(1_000_000);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("refreshes on reconnect (jittered, off the same instant as the drain)", async () => {
    const refresh = vi.fn();
    renderHook(() => useCatchup(true, refresh));
    expect(refresh).not.toHaveBeenCalled(); // not in the same tick as the event
    window.dispatchEvent(new Event("online"));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });

  it("refreshes promptly when the app returns to the foreground", () => {
    const refresh = vi.fn();
    renderHook(() => useCatchup(true, refresh));
    setVisible("visible"); // foreground: synchronous, not jittered
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("throttles rapid foregrounds but allows a later one", () => {
    const refresh = vi.fn();
    renderHook(() => useCatchup(true, refresh));
    setVisible("visible");
    expect(refresh).toHaveBeenCalledTimes(1);
    setVisible("visible"); // within the throttle window: suppressed
    expect(refresh).toHaveBeenCalledTimes(1);
    vi.spyOn(Date, "now").mockReturnValue(1_000_000 + 61_000); // past the window
    setVisible("visible");
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("does nothing when inactive (logged out)", async () => {
    const refresh = vi.fn();
    renderHook(() => useCatchup(false, refresh));
    window.dispatchEvent(new Event("online"));
    setVisible("visible");
    await tick();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("stops listening after unmount", async () => {
    const refresh = vi.fn();
    const { unmount } = renderHook(() => useCatchup(true, refresh));
    unmount();
    window.dispatchEvent(new Event("online"));
    await tick();
    expect(refresh).not.toHaveBeenCalled();
  });
});

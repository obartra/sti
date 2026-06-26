import { describe, it, expect, vi } from "vitest";
import {
  notifyUpdateReady,
  isUpdateReady,
  subscribeUpdate,
  applyUpdate,
} from "./swUpdate.ts";

describe("service worker update bus (slice 3)", () => {
  it("flips ready and notifies subscribers", () => {
    const seen: boolean[] = [];
    const unsub = subscribeUpdate(() => seen.push(true));

    notifyUpdateReady({ postMessage: vi.fn() });

    expect(isUpdateReady()).toBe(true);
    expect(seen).toEqual([true]);
    unsub();
  });

  it("applyUpdate posts SKIP_WAITING to the waiting worker", () => {
    const postMessage = vi.fn();
    notifyUpdateReady({ postMessage });
    applyUpdate();
    expect(postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
  });

  it("stops calling an unsubscribed listener", () => {
    const listener = vi.fn();
    const unsub = subscribeUpdate(listener);
    unsub();
    notifyUpdateReady({ postMessage: vi.fn() });
    expect(listener).not.toHaveBeenCalled();
  });
});

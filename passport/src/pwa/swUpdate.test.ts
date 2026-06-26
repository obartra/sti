import { describe, it, expect, vi } from "vitest";
import { notifyUpdateReady, applyPendingUpdate } from "./swUpdate.ts";

describe("silent service worker update (doc 22 section E)", () => {
  it("adopts a waiting worker on the next navigation, exactly once", () => {
    const postMessage = vi.fn();
    notifyUpdateReady({ postMessage });

    // The router calls this on a screen change: the waiting worker is asked to take
    // over (controllerchange then reloads the page onto the new version).
    applyPendingUpdate();
    expect(postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });

    // A second navigation does not re-apply: the worker was cleared after one adopt.
    applyPendingUpdate();
    expect(postMessage).toHaveBeenCalledTimes(1);
  });

  it("applyPendingUpdate is a no-op when no update is waiting", () => {
    // No notifyUpdateReady first: every navigation calls this, most with nothing to do.
    expect(() => applyPendingUpdate()).not.toThrow();
  });
});

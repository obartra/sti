import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  useUniformPoll,
  UNIFORM_POLL_INTERVAL_MS,
  UNIFORM_POLL_JITTER_MS,
} from "./useUniformPoll.ts";

// One advance window that is guaranteed to contain EXACTLY one scheduled tick: the
// max possible delay is INTERVAL + JITTER, and the min gap to the next tick is
// INTERVAL - JITTER, which is far larger than the leftover slack in one window, so no
// second tick can slip in. This lets a fake-timer test count ticks deterministically
// despite the random jitter.
const WINDOW_MS = UNIFORM_POLL_INTERVAL_MS + UNIFORM_POLL_JITTER_MS;

describe("useUniformPoll", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("does not poll while inactive (logged out)", () => {
    const refresh = vi.fn();
    renderHook(() => useUniformPoll(false, refresh));
    vi.advanceTimersByTime(WINDOW_MS * 3);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("polls once per cadence window while active", () => {
    const refresh = vi.fn();
    renderHook(() => useUniformPoll(true, refresh));
    expect(refresh).not.toHaveBeenCalled(); // nothing on mount; first tick is later

    vi.advanceTimersByTime(WINDOW_MS);
    expect(refresh).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(WINDOW_MS);
    expect(refresh).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(WINDOW_MS);
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it("is nudge-blind: the cadence never changes once a nudge is found", () => {
    // The hook is handed the owner-pull (which reuses pollPartnerNudge). Model a
    // device that starts finding a nudge partway through: the poll now "succeeds", but
    // the timer must not speed up, slow down, or stop. If cadence keyed on nudge
    // state, the per-window tick count would change after the nudge appears; it must
    // not, because a change in poll timing would leak that this is the recipient.
    let nudgePresent = false;
    const refresh = vi.fn(() => {
      // Reading a nudge is exactly what the real refresh does; the hook must ignore
      // the result. Returning a value here would be dropped by the void-return hook.
      void nudgePresent;
    });
    renderHook(() => useUniformPoll(true, refresh));

    vi.advanceTimersByTime(WINDOW_MS);
    vi.advanceTimersByTime(WINDOW_MS);
    expect(refresh).toHaveBeenCalledTimes(2); // 2 windows, no nudge yet

    nudgePresent = true; // a ping is now waiting for this device

    vi.advanceTimersByTime(WINDOW_MS);
    vi.advanceTimersByTime(WINDOW_MS);
    // Still exactly one tick per window: the same cadence, no back-off, no stop.
    expect(refresh).toHaveBeenCalledTimes(4);
  });

  it("drives the owner-pull each tick (reusing the partner-nudge poll)", () => {
    // In the app, `refresh` is useOwnerInbox's refreshInbox, which calls
    // controller.hasPartnerNudge -> pollPartnerNudge. Model that pull here to show the
    // scheduled tick reuses the SAME poll rather than any new device-initiated read.
    const pollPartnerNudge = vi.fn(() => Promise.resolve(false));
    const refresh = () => void pollPartnerNudge();
    renderHook(() => useUniformPoll(true, refresh));

    vi.advanceTimersByTime(WINDOW_MS);
    expect(pollPartnerNudge).toHaveBeenCalledTimes(1);
  });

  it("stops polling when it goes inactive", () => {
    const refresh = vi.fn();
    const { rerender } = renderHook(
      ({ active }: { active: boolean }) => useUniformPoll(active, refresh),
      { initialProps: { active: true } },
    );
    vi.advanceTimersByTime(WINDOW_MS);
    expect(refresh).toHaveBeenCalledTimes(1);

    rerender({ active: false });
    vi.advanceTimersByTime(WINDOW_MS * 3);
    expect(refresh).toHaveBeenCalledTimes(1); // no further ticks after logout
  });
});

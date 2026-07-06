import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useCardRefresh } from "./useCardRefresh.ts";
import type { OwnerSession, SessionController } from "../../store/index.ts";
import { INITIAL_OWNER_STATE } from "../../core/badge.ts";
import { DEFAULT_AVATAR } from "../../lib/avatars.ts";
import { fakeRootKey } from "../../test-support/phrase.ts";

function session(): OwnerSession {
  return {
    root: fakeRootKey(),
    blob: {
      handle: "robin",
      aliases: [],
      contacts: [],
      state: INITIAL_OWNER_STATE,
      avatar: DEFAULT_AVATAR,
      sharingMode: "public",
    },
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

function controllerWith(): {
  controller: SessionController;
  refreshLiveLinks: ReturnType<typeof vi.fn>;
} {
  const refreshLiveLinks = vi.fn(() => Promise.resolve());
  return {
    controller: { refreshLiveLinks } as unknown as SessionController,
    refreshLiveLinks,
  };
}

describe("useCardRefresh (republish-on-open, doc 02)", () => {
  it("republishes once on mount for a logged-in owner", async () => {
    const { controller, refreshLiveLinks } = controllerWith();
    const s = session();
    const ref = { current: s as OwnerSession | null };
    await act(async () => {
      renderHook(() => useCardRefresh(controller, ref, true));
      await flush();
    });
    expect(refreshLiveLinks).toHaveBeenCalledWith(s);
    expect(refreshLiveLinks).toHaveBeenCalledTimes(1);
  });

  it("collapses same-day focus re-fires to a single republish", async () => {
    const { controller, refreshLiveLinks } = controllerWith();
    const ref = { current: session() as OwnerSession | null };
    await act(async () => {
      renderHook(() => useCardRefresh(controller, ref, true));
      await flush();
    });
    // A focus later the same day must not republish again (the per-day guard).
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await flush();
    });
    expect(refreshLiveLinks).toHaveBeenCalledTimes(1);
  });

  it("is inert when logged out", async () => {
    const { controller, refreshLiveLinks } = controllerWith();
    const ref = { current: session() as OwnerSession | null };
    await act(async () => {
      renderHook(() => useCardRefresh(controller, ref, false));
      await flush();
    });
    expect(refreshLiveLinks).not.toHaveBeenCalled();
  });

  it("removes its listeners on unmount", async () => {
    const { controller, refreshLiveLinks } = controllerWith();
    const ref = { current: session() as OwnerSession | null };
    const { unmount } = renderHook(() => useCardRefresh(controller, ref, true));
    await act(async () => await flush());
    unmount();
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await flush();
    });
    // Only the mount republish; the post-unmount focus does nothing.
    expect(refreshLiveLinks).toHaveBeenCalledTimes(1);
  });
});

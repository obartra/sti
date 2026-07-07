import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useExpirySweep } from "./useExpirySweep.ts";
import type { OwnerSession, SessionController } from "../../store/index.ts";
import { INITIAL_OWNER_STATE } from "../../core/badge.ts";
import { DEFAULT_AVATAR } from "../../lib/avatars.ts";
import { fakeRootKey } from "../../test-support/phrase.ts";

// A session whose single alias has the given expiry (epoch ms; 1 = long past,
// null = until-revoked).
function sessionWith(expiresAt: number | null): OwnerSession {
  return {
    root: fakeRootKey(),
    blob: {
      handle: "robin",
      aliases: [
        {
          id: "a".repeat(43),
          writeToken: "w".repeat(43),
          key: "k".repeat(43),
          isPublic: true,
          expiresAt,
        },
      ],
      contacts: [],
      state: INITIAL_OWNER_STATE,
      avatar: DEFAULT_AVATAR,
    },
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

function controllerWith(sweep: () => Promise<OwnerSession>): {
  controller: SessionController;
  sweepExpiredLinks: ReturnType<typeof vi.fn>;
} {
  const sweepExpiredLinks = vi.fn(sweep);
  return {
    controller: { sweepExpiredLinks } as unknown as SessionController,
    sweepExpiredLinks,
  };
}

describe("useExpirySweep", () => {
  it("sweeps + folds the session on focus when a link is past its expiry", async () => {
    const expired = sessionWith(1);
    const swept = sessionWith(null);
    const { controller, sweepExpiredLinks } = controllerWith(() =>
      Promise.resolve(swept),
    );
    const ref = { current: expired as OwnerSession | null };
    const setSession = vi.fn((s: OwnerSession | null) => {
      ref.current = s;
    });

    renderHook(() => useExpirySweep(controller, ref, setSession, true));
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await flush();
    });

    expect(sweepExpiredLinks).toHaveBeenCalledWith(expired);
    expect(setSession).toHaveBeenCalledWith(swept);
    expect(ref.current).toBe(swept);
  });

  it("does NOT hit the network when nothing is due (in-memory pre-check)", async () => {
    const { controller, sweepExpiredLinks } = controllerWith(() =>
      Promise.resolve(sessionWith(null)),
    );
    const ref = { current: sessionWith(null) as OwnerSession | null };

    renderHook(() => useExpirySweep(controller, ref, vi.fn(), true));
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await flush();
    });

    expect(sweepExpiredLinks).not.toHaveBeenCalled();
  });

  it("is inert when logged out", async () => {
    const { controller, sweepExpiredLinks } = controllerWith(() =>
      Promise.resolve(sessionWith(null)),
    );
    const ref = { current: sessionWith(1) as OwnerSession | null };

    renderHook(() => useExpirySweep(controller, ref, vi.fn(), false));
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await flush();
    });

    expect(sweepExpiredLinks).not.toHaveBeenCalled();
  });

  it("removes its listeners on unmount", async () => {
    const { controller, sweepExpiredLinks } = controllerWith(() =>
      Promise.resolve(sessionWith(null)),
    );
    const ref = { current: sessionWith(1) as OwnerSession | null };

    const { unmount } = renderHook(() =>
      useExpirySweep(controller, ref, vi.fn(), true),
    );
    unmount();
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await flush();
    });

    expect(sweepExpiredLinks).not.toHaveBeenCalled();
  });

  it("sweeps on the interval while the app stays open", async () => {
    vi.useFakeTimers();
    try {
      const { controller, sweepExpiredLinks } = controllerWith(() =>
        Promise.resolve(sessionWith(null)),
      );
      const ref = { current: sessionWith(1) as OwnerSession | null };
      renderHook(() => useExpirySweep(controller, ref, vi.fn(), true));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
      });
      expect(sweepExpiredLinks).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

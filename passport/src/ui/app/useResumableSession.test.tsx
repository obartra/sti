import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useResumableSession } from "./useResumableSession.ts";
import type { OwnerSession, SessionController } from "../../store/index.ts";
import type { Nav } from "./useAppRouter.ts";
import { INITIAL_OWNER_STATE } from "../../core/badge.ts";
import { DEFAULT_AVATAR } from "../../lib/avatars.ts";

const aSession = {
  master: {} as CryptoKey,
  blob: {
    handle: "robin",
    aliases: [],
    contacts: [],
    state: INITIAL_OWNER_STATE,
    avatar: DEFAULT_AVATAR,
    sharingMode: "link",
  },
} as OwnerSession;

function fakeNav(): Nav {
  return { go: vi.fn(), back: vi.fn(), jump: vi.fn() };
}

// Only the three methods the hook touches; the mocks are returned as locals so
// assertions reference them directly (not as object methods, which trips
// no-unbound-method).
function setup(resumed: OwnerSession | null = null) {
  const remember = vi.fn(() => Promise.resolve());
  const forget = vi.fn(() => Promise.resolve());
  const ctl = {
    resumeFromStore: () => Promise.resolve(resumed),
    rememberDevice: remember,
    forgetDevice: forget,
  } as unknown as SessionController;
  const nav = fakeNav();
  return { ctl, nav, remember, forget };
}

describe("useResumableSession", () => {
  it("silently resumes from the persisted master on mount", async () => {
    const { ctl, nav } = setup(aSession);
    const { result } = renderHook(() => useResumableSession(ctl, nav));

    await waitFor(() => expect(result.current.session).toBe(aSession));
    expect(nav.jump).toHaveBeenCalledWith("home");
  });

  it("stays logged out when no master is stored", async () => {
    const { ctl, nav } = setup(null);
    const { result } = renderHook(() => useResumableSession(ctl, nav));
    // Give the resolved-null resume a tick.
    await Promise.resolve();
    expect(result.current.session).toBeNull();
  });

  it("persists on login by default (keep me signed in is ON)", () => {
    const { ctl, nav, remember, forget } = setup();
    const { result } = renderHook(() => useResumableSession(ctl, nav));

    act(() => result.current.onSession(aSession));
    expect(result.current.session).toBe(aSession);
    expect(remember).toHaveBeenCalledWith(aSession);
    expect(forget).not.toHaveBeenCalled();
  });

  it("does NOT persist on login when keep me signed in is OFF", () => {
    const { ctl, nav, remember, forget } = setup();
    const { result } = renderHook(() => useResumableSession(ctl, nav));

    act(() => result.current.setKeepSignedIn(false));
    act(() => result.current.onSession(aSession));
    expect(remember).not.toHaveBeenCalled();
    expect(forget).toHaveBeenCalled();
  });

  it("logs out: forgets the stored key, clears the session, returns to landing", () => {
    const { ctl, nav, forget } = setup();
    const { result } = renderHook(() => useResumableSession(ctl, nav));

    act(() => result.current.onSession(aSession));
    act(() => result.current.onLogOut());
    expect(forget).toHaveBeenCalled();
    expect(result.current.session).toBeNull();
    expect(nav.jump).toHaveBeenLastCalledWith("a1-landing", "public");
  });
});

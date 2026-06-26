import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useOwnerActions } from "./useOwnerActions.ts";
import type { OwnerSession, SessionController } from "../../store/index.ts";
import { INITIAL_OWNER_STATE } from "../../core/badge.ts";
import { DEFAULT_AVATAR, type AvatarConfig } from "../../lib/avatars.ts";

// onDeleteAccount fires disablePush() (IndexedDB); stub it so the test stays on
// localStorage and never touches a store jsdom may not provide.
vi.mock("../../store/push.ts", () => ({
  disablePush: vi.fn().mockResolvedValue(undefined),
}));

const session: OwnerSession = {
  master: new Uint8Array(32),
  blob: {
    handle: "robin",
    aliases: [],
    contacts: [],
    state: INITIAL_OWNER_STATE,
    avatar: DEFAULT_AVATAR,
    sharingMode: "public",
  },
};

function stubController(over: Partial<SessionController>): SessionController {
  const unused = () => {
    throw new Error("not used in this test");
  };
  return {
    signUp: unused,
    recover: unused,
    resume: unused,
    enrollPasskey: unused,
    setProfile: unused,
    sweepExpiredLinks: unused,
    setOwnerState: unused,
    shareLink: unused,
    renewLink: unused,
    deleteAccount: unused,
    reviewKnocks: unused,
    approveKnocks: unused,
    createContactLink: unused,
    revokeContact: unused,
    setContactDuration: unused,
    setShareLinkDuration: unused,
    revokeAlias: unused,
    acceptContactInvite: unused,
    ingestContactReturn: unused,
    notifyContactsOfPositive: unused,
    hasPartnerNudge: unused,
    createCircle: unused,
    updateCircle: unused,
    removeCircle: unused,
    registerVanityName: unused,
    releaseVanityName: unused,
    forget: unused,
    ...over,
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("useOwnerActions.onDeleteAccount", () => {
  // The test env's global localStorage is unreliable (the store code guards every
  // access for exactly this reason), so back it with an in-memory map here.
  beforeEach(() => {
    const map = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
      clear: () => map.clear(),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("wipes this device's viewer secrets (requester + grant keys) on the way out", async () => {
    localStorage.setItem("sti.requester.v1", "some-secret");
    localStorage.setItem(
      "sti.grantkeys.v1",
      JSON.stringify({ "alias-1": { publicKey: "p", privateKey: "k" } }),
    );
    const deleteAccount = vi.fn().mockResolvedValue(undefined);
    const ref: { current: OwnerSession | null } = { current: session };
    const setSession = vi.fn();
    const { result } = renderHook(() =>
      useOwnerActions(stubController({ deleteAccount }), ref, setSession),
    );

    await act(async () => {
      result.current.onDeleteAccount();
      await flush();
    });

    expect(deleteAccount).toHaveBeenCalledWith(session);
    expect(setSession).toHaveBeenCalledWith(null);
    expect(ref.current).toBeNull();
    expect(localStorage.getItem("sti.requester.v1")).toBeNull();
    expect(localStorage.getItem("sti.grantkeys.v1")).toBeNull();
  });

  it("is a no-op when logged out (no session)", async () => {
    const deleteAccount = vi.fn();
    const ref: { current: OwnerSession | null } = { current: null };
    const { result } = renderHook(() =>
      useOwnerActions(stubController({ deleteAccount }), ref, vi.fn()),
    );

    await act(async () => {
      result.current.onDeleteAccount();
      await flush();
    });

    expect(deleteAccount).not.toHaveBeenCalled();
  });
});

describe("useOwnerActions.onSetAvatar", () => {
  it("persists via setProfile keeping the current sharing mode, then folds the session", async () => {
    const next: AvatarConfig = {
      hair: 4,
      mood: 1,
      skin: 2,
      hairColor: 5,
      beard: 1,
    };
    const updated: OwnerSession = {
      ...session,
      blob: { ...session.blob, avatar: next },
    };
    const setProfile = vi.fn().mockResolvedValue(updated);
    const ref = { current: session };
    const setSession = vi.fn();
    const { result } = renderHook(() =>
      useOwnerActions(stubController({ setProfile }), ref, setSession),
    );

    await act(async () => {
      result.current.onSetAvatar(next);
      await flush();
    });

    expect(setProfile).toHaveBeenCalledWith(session, {
      avatar: next,
      sharingMode: "public",
    });
    expect(setSession).toHaveBeenCalledWith(updated);
    expect(ref.current).toBe(updated);
  });

  it("is a no-op when logged out (no session)", async () => {
    const setProfile = vi.fn();
    const ref: { current: OwnerSession | null } = { current: null };
    const setSession = vi.fn();
    const { result } = renderHook(() =>
      useOwnerActions(stubController({ setProfile }), ref, setSession),
    );

    await act(async () => {
      result.current.onSetAvatar({
        hair: 1,
        mood: 1,
        skin: 1,
        hairColor: 1,
        beard: 0,
      });
      await flush();
    });

    expect(setProfile).not.toHaveBeenCalled();
    expect(setSession).not.toHaveBeenCalled();
  });
});

describe("useOwnerActions findable", () => {
  it("claims a name, folds the session, and returns the outcome", async () => {
    const claimed: OwnerSession = {
      ...session,
      blob: { ...session.blob, findable: { name: "robin", aliasId: "a" } },
    };
    const registerVanityName = vi
      .fn()
      .mockResolvedValue({ session: claimed, result: "registered" });
    const ref = { current: session };
    const setSession = vi.fn();
    const { result } = renderHook(() =>
      useOwnerActions(stubController({ registerVanityName }), ref, setSession),
    );

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.onRegisterVanityName("robin");
    });

    expect(registerVanityName).toHaveBeenCalledWith(session, "robin");
    expect(outcome).toBe("registered");
    expect(setSession).toHaveBeenCalledWith(claimed);
    expect(ref.current).toBe(claimed);
  });

  it("on an unavailable name folds the (unchanged) session and surfaces the reason", async () => {
    const registerVanityName = vi
      .fn()
      .mockResolvedValue({ session, result: "unavailable" });
    const ref = { current: session };
    const setSession = vi.fn();
    const { result } = renderHook(() =>
      useOwnerActions(stubController({ registerVanityName }), ref, setSession),
    );

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.onRegisterVanityName("taken");
    });

    expect(outcome).toBe("unavailable");
  });

  it("releases a name and folds the resulting session", async () => {
    const released: OwnerSession = { ...session };
    const releaseVanityName = vi.fn().mockResolvedValue(released);
    const ref = { current: session };
    const setSession = vi.fn();
    const { result } = renderHook(() =>
      useOwnerActions(stubController({ releaseVanityName }), ref, setSession),
    );

    await act(async () => {
      await result.current.onReleaseVanityName();
    });

    expect(releaseVanityName).toHaveBeenCalledWith(session);
    expect(setSession).toHaveBeenCalledWith(released);
  });

  it("registering is a no-op returning 'error' when logged out", async () => {
    const registerVanityName = vi.fn();
    const ref: { current: OwnerSession | null } = { current: null };
    const setSession = vi.fn();
    const { result } = renderHook(() =>
      useOwnerActions(stubController({ registerVanityName }), ref, setSession),
    );

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.onRegisterVanityName("robin");
    });

    expect(outcome).toBe("error");
    expect(registerVanityName).not.toHaveBeenCalled();
    expect(setSession).not.toHaveBeenCalled();
  });
});

import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useOwnerActions } from "./useOwnerActions.ts";
import type { OwnerSession, SessionController } from "../../store/index.ts";
import { INITIAL_OWNER_STATE } from "../../core/badge.ts";
import { DEFAULT_AVATAR, type AvatarConfig } from "../../lib/avatars.ts";

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
    forget: unused,
    ...over,
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("useOwnerActions.onSetAvatar", () => {
  it("persists via setProfile keeping the current sharing mode, then folds the session", async () => {
    const next: AvatarConfig = { hair: 4, mood: 1, tone: 3 };
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
      result.current.onSetAvatar({ hair: 1, mood: 1, tone: 1 });
      await flush();
    });

    expect(setProfile).not.toHaveBeenCalled();
    expect(setSession).not.toHaveBeenCalled();
  });
});

import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useShareLink } from "./useShareLink.ts";
import type {
  OwnerSession,
  SessionController,
  ShareLinkResult,
} from "../../store/index.ts";
import { INITIAL_OWNER_STATE } from "../../core/badge.ts";
import { DEFAULT_AVATAR } from "../../lib/avatars.ts";
import { fakeRootKey } from "../../test-support/phrase.ts";

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const session: OwnerSession = {
  root: fakeRootKey(),
  blob: {
    handle: "robin",
    aliases: [],
    contacts: [],
    state: INITIAL_OWNER_STATE,
    avatar: DEFAULT_AVATAR,
    sharingMode: "link",
  },
};

const RESULT: ShareLinkResult = {
  session,
  url: "https://sti.care/a/abc",
};

// Minimal controller stub: only the link methods are exercised here.
function stubController(over: Partial<SessionController>): SessionController {
  const unused = () => {
    throw new Error("not used in this test");
  };
  return {
    signUp: unused,
    recover: unused,
    recoverByPassword: unused,
    resume: unused,
    rememberDevice: unused,
    forgetDevice: unused,
    resumeFromStore: unused,
    enrollPasskey: unused,
    setProfile: unused,
    sweepExpiredLinks: unused,
    refreshLiveLinks: unused,
    setOwnerState: unused,
    shareLink: unused,
    renewLink: unused,
    setShareLinkExpiry: unused,
    deleteAccount: unused,
    reviewKnocks: unused,
    approveKnocks: unused,
    createContactLink: unused,
    renameContact: unused,
    revokeContact: unused,
    revokeAlias: unused,
    acceptContactInvite: unused,
    ingestContactReturn: unused,
    notifyContactsOfPositive: unused,
    hasPartnerNudge: unused,
    createCircle: unused,
    updateCircle: unused,
    removeCircle: unused,
    registerVanityName: unused,
    checkVanityName: unused,
    releaseVanityName: unused,
    createGroup: unused,
    inviteToGroup: unused,
    revokeGroupInvite: unused,
    acceptGroupInvite: unused,
    rejectGroupInvite: unused,
    pollGroupLifecycle: unused,
    removeGroupMember: unused,
    readGroupRoster: unused,
    requestToJoin: unused,
    reviewJoinRequests: unused,
    approveJoinRequest: unused,
    rejectJoinRequest: unused,
    redeemJoinRequests: unused,
    leaveGroup: unused,
    deleteGroup: unused,
    setRecoveryPassword: unused,
    disableRecoveryPassword: unused,
    passkeyEnrolled: unused,
    verifyPasskey: unused,
    forget: unused,
    ...over,
  };
}

function setup(controller: SessionController) {
  const ref = { current: session as OwnerSession | null };
  const setSession = vi.fn((s: OwnerSession) => {
    ref.current = s;
  });
  const setShareOpen = vi.fn();
  const { result } = renderHook(() =>
    useShareLink(controller, ref, setSession, setShareOpen),
  );
  return { result, setShareOpen };
}

describe("useShareLink serialization", () => {
  it("drops a second open while one is in flight (no duplicate mint)", async () => {
    const d = deferred<ShareLinkResult>();
    const shareLink = vi.fn(() => d.promise);
    const { result } = setup(stubController({ shareLink }));

    act(() => result.current.setShareOpen(true));
    act(() => result.current.setShareOpen(true)); // racing second open
    expect(shareLink).toHaveBeenCalledTimes(1);

    await act(async () => {
      d.resolve(RESULT);
      await d.promise;
    });
    expect(result.current.shareUrl).toBe(RESULT.url);
  });

  it("resets after a rejection so a later action still runs", async () => {
    const d1 = deferred<ShareLinkResult>();
    const shareLink = vi.fn(() => d1.promise);
    const { result } = setup(stubController({ shareLink }));

    act(() => result.current.setShareOpen(true));
    await act(async () => {
      d1.reject(new Error("network"));
      await d1.promise.catch(() => undefined);
    });

    // The in-flight guard is cleared on rejection, so a fresh open is honored.
    const d2 = deferred<ShareLinkResult>();
    shareLink.mockReturnValueOnce(d2.promise);
    act(() => result.current.setShareOpen(true));
    expect(shareLink).toHaveBeenCalledTimes(2);
    await act(async () => {
      d2.resolve(RESULT);
      await d2.promise;
    });
    expect(result.current.shareUrl).toBe(RESULT.url);
  });
});

describe("useShareLink identity choice", () => {
  it("opens anonymous by default and mints with that face", async () => {
    const d = deferred<ShareLinkResult>();
    const shareLink = vi.fn(() => d.promise);
    const { result } = setup(stubController({ shareLink }));

    expect(result.current.identity).toBe("anonymous");
    act(() => result.current.setShareOpen(true));
    expect(shareLink).toHaveBeenCalledWith(session, "anonymous", undefined);
    await act(async () => {
      d.resolve(RESULT);
      await d.promise;
    });
  });

  it("changing the face rotates to a fresh alias carrying it (renew)", async () => {
    const d = deferred<ShareLinkResult>();
    const renewLink = vi.fn(() => d.promise);
    const { result } = setup(stubController({ renewLink }));

    act(() => result.current.setIdentity("main"));
    expect(result.current.identity).toBe("main");
    expect(renewLink).toHaveBeenCalledWith(session, "main", undefined);
    await act(async () => {
      d.resolve(RESULT);
      await d.promise;
    });
  });

  it("re-selecting the current face is a no-op (no rotation)", () => {
    const renewLink = vi.fn();
    const { result } = setup(stubController({ renewLink }));
    act(() => result.current.setIdentity("anonymous")); // already anonymous
    expect(renewLink).not.toHaveBeenCalled();
  });

  it("picking a per-link face rotates carrying that override (doc 15)", async () => {
    const d = deferred<ShareLinkResult>();
    const renewLink = vi.fn(() => d.promise);
    const { result } = setup(stubController({ renewLink }));

    const face = { hair: 2, mood: 1, skin: 4, hairColor: 3, beard: 1 };
    act(() => result.current.setIdentity("main"));
    await act(async () => {
      d.resolve(RESULT);
      await d.promise;
    });
    const d2 = deferred<ShareLinkResult>();
    renewLink.mockReturnValueOnce(d2.promise);
    act(() => result.current.setAvatarOverride(face));
    expect(result.current.avatarOverride).toEqual(face);
    expect(renewLink).toHaveBeenLastCalledWith(session, "main", face);
    await act(async () => {
      d2.resolve(RESULT);
      await d2.promise;
    });
  });

  it("clearing the per-link face falls back to the default (undefined override)", async () => {
    const d = deferred<ShareLinkResult>();
    const renewLink = vi.fn(() => d.promise);
    const { result } = setup(stubController({ renewLink }));

    act(() => result.current.setAvatarOverride(undefined));
    expect(result.current.avatarOverride).toBeUndefined();
    expect(renewLink).toHaveBeenLastCalledWith(session, "anonymous", undefined);
    await act(async () => {
      d.resolve(RESULT);
      await d.promise;
    });
  });
});

describe("useShareLink lifetime", () => {
  const DAY_MS = 24 * 60 * 60 * 1000;

  it("defaults to until-turned-off with no private link yet", () => {
    const { result } = setup(stubController({}));
    expect(result.current.lifetime).toBeNull();
  });

  it("reads the current lifetime off the private-link alias's expiry", () => {
    const expiring: OwnerSession = {
      ...session,
      blob: {
        ...session.blob,
        aliases: [
          {
            id: "abc",
            key: "k",
            writeToken: "w",
            isPublic: false,
            expiresAt: Date.now() + 7 * DAY_MS,
          },
        ],
      },
    };
    const ref = { current: expiring as OwnerSession | null };
    const { result } = renderHook(() =>
      useShareLink(stubController({}), ref, vi.fn(), vi.fn()),
    );
    // Seven days out snaps to the 7-day preset.
    expect(result.current.lifetime).toBe(7 * DAY_MS);
  });

  it("setLifetime calls the controller with the chosen duration and folds the session", async () => {
    const d = deferred<OwnerSession>();
    const setShareLinkExpiry = vi.fn(() => d.promise);
    const { result } = setup(stubController({ setShareLinkExpiry }));

    act(() => result.current.setLifetime(7 * DAY_MS));
    expect(setShareLinkExpiry).toHaveBeenCalledWith(session, 7 * DAY_MS);
    // Reflected at once (the URL is unchanged, only the expiry moves).
    expect(result.current.lifetime).toBe(7 * DAY_MS);
    await act(async () => {
      d.resolve(session);
      await d.promise;
    });
  });

  it("setLifetime(null) sets until-turned-off", () => {
    const setShareLinkExpiry = vi.fn(() => Promise.resolve(session));
    const { result } = setup(stubController({ setShareLinkExpiry }));
    act(() => result.current.setLifetime(null));
    expect(setShareLinkExpiry).toHaveBeenCalledWith(session, null);
    expect(result.current.lifetime).toBeNull();
  });
});

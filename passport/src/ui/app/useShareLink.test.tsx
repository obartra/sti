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
    resume: unused,
    rememberDevice: unused,
    forgetDevice: unused,
    resumeFromStore: unused,
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
    renameContact: unused,
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
    checkVanityName: unused,
    releaseVanityName: unused,
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
    expect(shareLink).toHaveBeenCalledWith(session, "anonymous");
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
    expect(renewLink).toHaveBeenCalledWith(session, "main");
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
});

describe("useShareLink lifetime", () => {
  it("defaults to no expiry and sets a lifetime in place (no renew)", () => {
    const setShareLinkDuration = vi.fn(() => Promise.resolve(session));
    const renewLink = vi.fn();
    const { result } = setup(
      stubController({ setShareLinkDuration, renewLink }),
    );

    expect(result.current.duration).toBeNull();
    act(() => result.current.setDuration(7));
    expect(result.current.duration).toBe(7);
    // The link's expiry moves in place; it is NOT a renew (the URL is unchanged).
    expect(setShareLinkDuration).toHaveBeenCalledWith(session, 7);
    expect(renewLink).not.toHaveBeenCalled();
  });

  it("re-selecting the current lifetime is a no-op", () => {
    const setShareLinkDuration = vi.fn(() => Promise.resolve(session));
    const { result } = setup(stubController({ setShareLinkDuration }));
    act(() => result.current.setDuration(null)); // already null
    expect(setShareLinkDuration).not.toHaveBeenCalled();
  });

  it("resets the lifetime when the face changes (renew mints a no-expiry alias)", () => {
    const renewLink = vi.fn(() => Promise.resolve(RESULT));
    const setShareLinkDuration = vi.fn(() => Promise.resolve(session));
    const { result } = setup(
      stubController({ renewLink, setShareLinkDuration }),
    );

    act(() => result.current.setDuration(7));
    expect(result.current.duration).toBe(7);

    // Changing the face renews the alias, which drops its expiry: the control
    // must fall back to "no expiry" so it does not claim a lifetime the new link
    // lacks.
    act(() => result.current.setIdentity("main"));
    expect(result.current.duration).toBeNull();

    // And re-applying that same lifetime now works (not deduped against a stale
    // value).
    act(() => result.current.setDuration(7));
    expect(setShareLinkDuration).toHaveBeenCalledTimes(2);
  });
});

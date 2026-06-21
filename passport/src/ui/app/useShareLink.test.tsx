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
  master: new Uint8Array(32),
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
    revokeAlias: unused,
    acceptContactInvite: unused,
    ingestContactReturn: unused,
    notifyContactsOfPositive: unused,
    hasPartnerNudge: unused,
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

import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { usePartnerNudge } from "./usePartnerNudge.ts";
import type { OwnerSession, SessionController } from "../../store/index.ts";
import { INITIAL_OWNER_STATE } from "../../core/badge.ts";
import { DEFAULT_AVATAR } from "../../lib/avatars.ts";
import { fakeRootKey } from "../../test-support/phrase.ts";
import { mintNotify } from "../../store/index.ts";

// A session with one contact whose per-contact receiving inbox carries inboxId, so
// the hook (which keys its poll on the set of contact inbox ids) re-pulls when it
// changes.
function sessionWithInbox(inboxId: string): OwnerSession {
  return {
    root: fakeRootKey(),
    blob: {
      handle: "robin",
      aliases: [],
      contacts: [
        {
          id: "c".repeat(43),
          label: "",
          createdDay: 0,
          expiresAt: null,
          alias: {
            id: "d".repeat(43),
            writeToken: "e".repeat(43),
            key: "f".repeat(43),
            isPublic: false,
          },
          myInbox: { ...mintNotify(), inboxId },
        },
      ],
      state: INITIAL_OWNER_STATE,
      avatar: DEFAULT_AVATAR,
      sharingMode: "link",
    },
  };
}

// A controller whose nudge result we control, with a spy on the poll.
function stubController(
  hasPartnerNudge = vi.fn(() => Promise.resolve(true)),
): SessionController {
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
    revokeContact: unused,
    setContactDuration: unused,
    setShareLinkDuration: unused,
    revokeAlias: unused,
    acceptContactInvite: unused,
    ingestContactReturn: unused,
    notifyContactsOfPositive: unused,
    hasPartnerNudge,
    createCircle: unused,
    updateCircle: unused,
    removeCircle: unused,
    registerVanityName: unused,
    releaseVanityName: unused,
    forget: unused,
  };
}

describe("usePartnerNudge", () => {
  it("shows the nudge when the inbox holds a ping", async () => {
    const controller = stubController();
    const { result } = renderHook(() =>
      usePartnerNudge(controller, sessionWithInbox("a".repeat(43))),
    );
    await waitFor(() => expect(result.current.showNudge).toBe(true));
  });

  it("is empty logged out (no poll)", async () => {
    const hasPartnerNudge = vi.fn(() => Promise.resolve(true));
    const controller = stubController(hasPartnerNudge);
    const { result } = renderHook(() => usePartnerNudge(controller, null));
    await waitFor(() => expect(result.current.showNudge).toBe(false));
    expect(hasPartnerNudge).not.toHaveBeenCalled();
  });

  it("dismiss hides the row even though the contentless ping is still there", async () => {
    const controller = stubController();
    const { result } = renderHook(() =>
      usePartnerNudge(controller, sessionWithInbox("a".repeat(43))),
    );
    await waitFor(() => expect(result.current.showNudge).toBe(true));

    // The server is blind to a read, so a re-poll still returns the ping; the
    // session-scoped dismiss keeps the row hidden.
    act(() => result.current.dismiss());
    await waitFor(() => expect(result.current.showNudge).toBe(false));
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.showNudge).toBe(false));
  });

  it("clears the dismiss when the account (inbox) changes", async () => {
    const controller = stubController();
    const { result, rerender } = renderHook(
      ({ s }) => usePartnerNudge(controller, s),
      { initialProps: { s: sessionWithInbox("a".repeat(43)) } },
    );
    await waitFor(() => expect(result.current.showNudge).toBe(true));
    act(() => result.current.dismiss());
    await waitFor(() => expect(result.current.showNudge).toBe(false));

    // A different account logs in (new inbox id): the dismiss must reset so the
    // new account's nudge is not silently hidden.
    rerender({ s: sessionWithInbox("b".repeat(43)) });
    await waitFor(() => expect(result.current.showNudge).toBe(true));
  });
});

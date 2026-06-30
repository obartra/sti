import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useKnockReview } from "./useKnockReview.ts";
import type {
  OwnerKnocks,
  OwnerSession,
  PendingApproval,
  SessionController,
} from "../../store/index.ts";
import { INITIAL_OWNER_STATE } from "../../core/badge.ts";
import { DEFAULT_AVATAR } from "../../lib/avatars.ts";
import { fakeRootKey } from "../../test-support/phrase.ts";

function sessionWithAlias(aliasId: string): OwnerSession {
  return {
    root: fakeRootKey(),
    blob: {
      handle: "robin",
      aliases: [
        { id: aliasId, writeToken: "w".repeat(43), key: "k", isPublic: false },
      ],
      contacts: [],
      state: INITIAL_OWNER_STATE,
      avatar: DEFAULT_AVATAR,
      sharingMode: "link",
    },
  };
}

function approvalOn(aliasId: string, requesterHash: string): PendingApproval {
  return {
    alias: {
      id: aliasId,
      writeToken: "w".repeat(43),
      key: "k",
      isPublic: false,
    },
    pending: { requesterHash, pubKey: "pub-" + requesterHash },
  };
}

// A controller whose review result we can swap between renders, with a spy on
// approveKnocks. Only the knock methods are exercised here.
function stubController(
  review: () => OwnerKnocks,
  approveKnocks = vi.fn(() => Promise.resolve(1)),
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
    reviewKnocks: () => Promise.resolve(review()),
    approveKnocks,
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
  };
}

describe("useKnockReview granted-set clearing", () => {
  it("hides a knock after approving it, even though the server keeps returning it", async () => {
    const review = { count: 1, pending: [approvalOn("a".repeat(43), "req1")] };
    const approveKnocks = vi.fn(() => Promise.resolve(1));
    const controller = stubController(() => review, approveKnocks);
    const session = sessionWithAlias("a".repeat(43));

    const { result } = renderHook(() => useKnockReview(controller, session));
    await waitFor(() => expect(result.current.canApprove).toBe(true));

    // Approve: the server is blind to the grant, so the next review still returns
    // the same knock, but the hook hides it -> canApprove goes false.
    act(() => result.current.approve());
    expect(approveKnocks).toHaveBeenCalledOnce();
    await waitFor(() => expect(result.current.canApprove).toBe(false));

    // A manual refresh re-pulling the SAME knock keeps it hidden.
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.canApprove).toBe(false));
  });

  it("a genuinely new requester reappears as approvable after one was granted", async () => {
    let pending = [approvalOn("a".repeat(43), "req1")];
    const controller = stubController(() => ({
      count: pending.length,
      pending,
    }));
    const session = sessionWithAlias("a".repeat(43));

    const { result } = renderHook(() => useKnockReview(controller, session));
    await waitFor(() => expect(result.current.canApprove).toBe(true));
    act(() => result.current.approve());
    await waitFor(() => expect(result.current.canApprove).toBe(false));

    // A different requester knocks; it is NOT in the granted set, so it shows.
    pending = [approvalOn("a".repeat(43), "req2")];
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.canApprove).toBe(true));
  });

  it("resets the granted memory when the account (alias set) changes", async () => {
    const controller = stubController(() => ({
      count: 1,
      pending: [approvalOn("a".repeat(43), "req1")],
    }));
    const first = sessionWithAlias("a".repeat(43));

    const { result, rerender } = renderHook(
      ({ s }) => useKnockReview(controller, s),
      { initialProps: { s: first } },
    );
    await waitFor(() => expect(result.current.canApprove).toBe(true));
    act(() => result.current.approve());
    await waitFor(() => expect(result.current.canApprove).toBe(false));

    // A different account logs in (new alias id). The granted memory must clear,
    // so a same-keyed knock for the new account is not silently hidden.
    rerender({ s: sessionWithAlias("b".repeat(43)) });
    await waitFor(() => expect(result.current.canApprove).toBe(true));
  });

  it("the contentless info row shows for non-grantable knocks (no key)", async () => {
    const controller = stubController(() => ({ count: 2, pending: [] }));
    const session = sessionWithAlias("a".repeat(43));
    const { result } = renderHook(() => useKnockReview(controller, session));
    await waitFor(() => expect(result.current.knockCount).toBe(2));
    expect(result.current.canApprove).toBe(false);
    expect(result.current.showInfo).toBe(true); // 2 knocks, 0 grantable
  });
});

import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useOwnerInbox } from "./useOwnerInbox.ts";
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
    },
  };
}

// A controller whose two owner-pull channels resolve to "nothing".
function stubController(): SessionController {
  const unused = () => {
    throw new Error("not used in this test");
  };
  return {
    reviewKnocks: vi.fn(() => Promise.resolve({ count: 0, pending: [] })),
    hasPartnerNudge: vi.fn(() => Promise.resolve(false)),
  } as unknown as SessionController;
  void unused;
}

describe("useOwnerInbox", () => {
  // Regression: refreshInbox must keep a STABLE identity across re-renders that do
  // not change the session. It used to depend on the two hook return objects (fresh
  // literals every render), so its identity churned every render and cancelled a
  // pending jittered reconnect catch-up in useCatchup before it could fire.
  it("keeps refreshInbox stable across re-renders with the same session", () => {
    const controller = stubController();
    const s = session();
    const { result, rerender } = renderHook(() => useOwnerInbox(controller, s));
    const first = result.current.refreshInbox;
    rerender();
    rerender();
    expect(result.current.refreshInbox).toBe(first);
  });

  it("re-keys refreshInbox when the session changes", () => {
    const controller = stubController();
    const { result, rerender } = renderHook(
      ({ s }: { s: OwnerSession }) => useOwnerInbox(controller, s),
      { initialProps: { s: session() } },
    );
    const first = result.current.refreshInbox;
    rerender({ s: session() }); // a different session object identity (e.g. account swap)
    expect(result.current.refreshInbox).not.toBe(first);
  });
});

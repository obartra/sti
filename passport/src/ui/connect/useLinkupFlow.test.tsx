// The linkup state machine (doc 25) without a camera: the offer mints on mount,
// a scanned offer completes this side (in either order relative to the mint), a
// scanned plain link routes to the view flow, and closing discards the pending
// offer only while nothing linked. The camera and markup are covered elsewhere;
// this pins the decisions.
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { todayEpochDay } from "../../core/clock.ts";
import type { ContactInvite, ScannedConnect } from "../../store/index.ts";
import type { ResolvedView } from "../public/PublicResolution.tsx";
import { useLinkupFlow, type LinkupDeps } from "./useLinkupFlow.ts";

const NOTIFY = {
  inboxId: "i",
  writeToken: "w",
  key: "k",
  routingToken: "r",
} as const;

function offer(extra: Partial<ContactInvite> = {}): ScannedConnect {
  return {
    kind: "offer",
    invite: {
      alias: { id: "peer-alias", key: "peer-key" },
      notify: NOTIFY,
      ...extra,
    },
    snapshot: { badge: "blue", day: todayEpochDay() },
  };
}

function deps(over: Partial<LinkupDeps> = {}): LinkupDeps {
  return {
    createOffer: () =>
      Promise.resolve({ contactId: "c1", url: "https://x/a/1#k=2" }),
    complete: vi.fn(() => Promise.resolve()),
    discard: vi.fn(),
    resolvePeer: () => new Promise<ResolvedView | null>(() => undefined),
    onViewLink: vi.fn(),
    onExit: vi.fn(),
    ...over,
  };
}

describe("useLinkupFlow", () => {
  it("mints the offer on mount and shows it", async () => {
    const { result } = renderHook(() => useLinkupFlow(deps()));
    expect(result.current.phase.kind).toBe("pending");
    await waitFor(() => expect(result.current.phase.kind).toBe("showing"));
    expect(result.current.phase).toEqual({
      kind: "showing",
      url: "https://x/a/1#k=2",
    });
  });

  it("fails honestly and retries", async () => {
    let attempts = 0;
    const d = deps({
      createOffer: () => {
        attempts += 1;
        return attempts === 1
          ? Promise.reject(new Error("offline"))
          : Promise.resolve({ contactId: "c1", url: "https://x/a/1#k=2" });
      },
    });
    const { result } = renderHook(() => useLinkupFlow(d));
    await waitFor(() => expect(result.current.phase.kind).toBe("failed"));
    act(() => result.current.onRetry());
    await waitFor(() => expect(result.current.phase.kind).toBe("showing"));
  });

  it("completes with a scanned offer: records the link, shows the peer", async () => {
    const complete = vi.fn(() => Promise.resolve());
    const { result } = renderHook(() => useLinkupFlow(deps({ complete })));
    await waitFor(() => expect(result.current.phase.kind).toBe("showing"));
    act(() => result.current.onScanned(offer({ sharedName: "Sam" })));
    expect(complete).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({ alias: { id: "peer-alias", key: "peer-key" } }),
    );
    expect(result.current.phase).toEqual({
      kind: "linked",
      peer: { label: "Sam", badge: "blue" },
    });
  });

  it("holds a scan that lands before the offer minted, then completes", async () => {
    let mint: (v: { contactId: string; url: string }) => void = () => undefined;
    const complete = vi.fn(() => Promise.resolve());
    const d = deps({
      complete,
      createOffer: () =>
        new Promise((res) => {
          mint = res;
        }),
    });
    const { result } = renderHook(() => useLinkupFlow(d));
    act(() => result.current.onScanned(offer()));
    expect(complete).not.toHaveBeenCalled();
    act(() => mint({ contactId: "late", url: "https://x/a/1#k=2" }));
    await waitFor(() => expect(result.current.phase.kind).toBe("linked"));
    expect(complete).toHaveBeenCalledWith("late", expect.anything());
  });

  it("ignores a stale snapshot and fills the badge from the live resolve", async () => {
    const view: ResolvedView = { state: "blue", identity: { handle: "otter" } };
    const { result } = renderHook(() =>
      useLinkupFlow(deps({ resolvePeer: () => Promise.resolve(view) })),
    );
    await waitFor(() => expect(result.current.phase.kind).toBe("showing"));
    act(() =>
      result.current.onScanned({
        ...offer(),
        snapshot: { badge: "blue", day: todayEpochDay() - 3 },
      } as ScannedConnect),
    );
    await waitFor(() =>
      expect(result.current.phase).toEqual({
        kind: "linked",
        peer: { label: "otter", badge: "blue" },
      }),
    );
  });

  it("routes a scanned plain link to the view flow", async () => {
    const onViewLink = vi.fn();
    const { result } = renderHook(() => useLinkupFlow(deps({ onViewLink })));
    await waitFor(() => expect(result.current.phase.kind).toBe("showing"));
    act(() =>
      result.current.onScanned({ kind: "link", link: { id: "a", key: "b" } }),
    );
    expect(onViewLink).toHaveBeenCalledWith({ id: "a", key: "b" });
    expect(result.current.phase.kind).toBe("showing");
  });

  it("closing before a link discards the offer; after, it keeps it", async () => {
    const discard = vi.fn();
    const onExit = vi.fn();
    const d = deps({ discard, onExit });
    const first = renderHook(() => useLinkupFlow(d));
    await waitFor(() =>
      expect(first.result.current.phase.kind).toBe("showing"),
    );
    act(() => first.result.current.onClose());
    expect(discard).toHaveBeenCalledWith("c1");
    expect(onExit).toHaveBeenCalledTimes(1);

    discard.mockClear();
    const second = renderHook(() => useLinkupFlow(d));
    await waitFor(() =>
      expect(second.result.current.phase.kind).toBe("showing"),
    );
    act(() => second.result.current.onScanned(offer()));
    act(() => second.result.current.onClose());
    expect(discard).not.toHaveBeenCalled();
    expect(onExit).toHaveBeenCalledTimes(2);
  });
});

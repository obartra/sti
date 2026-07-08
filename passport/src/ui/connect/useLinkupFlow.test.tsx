// The linkup state machine (doc 25) without a camera: the offer mints on mount,
// a scanned offer completes this side (in either order relative to the mint), a
// scanned plain link routes to the view flow, and closing discards whatever
// never finished. The open-door legs run over injected fakes: once linked the
// door opens, an arrival is admitted with a freshly minted bundle and completes
// when its return lands, and a scanned door knocks + redeems the joiner side.
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { todayEpochDay } from "../../core/clock.ts";
import {
  contactInviteUrl,
  mintNotify,
  offerUrlWithBadge,
  type ContactInvite,
  type DoorGrant,
  type ScannedConnect,
} from "../../store/index.ts";
import { randomAliasId, randomWriteToken } from "../../crypto/index.ts";
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

// A REAL offer URL (admitting an arrival parses the minted URL back into the
// invite it carries, so the fake mint must produce the genuine codec output).
function realOfferUrl(): string {
  return offerUrlWithBadge(
    contactInviteUrl(
      {
        id: randomAliasId(),
        writeToken: randomWriteToken(),
        key: randomAliasId(),
        isPublic: false,
      },
      mintNotify(),
    ),
    { badge: "blue", day: todayEpochDay() },
  );
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
    pollMs: 5,
    ...over,
  };
}

// A controllable in-memory door: arrivals/returns/grants are plain fields the
// test flips, and every call is recorded.
function fakeDoor() {
  const state = {
    arrivals: [] as { requesterHash: string; pubKey: string }[],
    returns: new Map<string, ContactInvite>(),
    grants: new Map<string, DoorGrant>(),
  };
  const door = {
    open: vi.fn(() =>
      Promise.resolve({ pointerId: "door-1", writeToken: "wt" }),
    ),
    close: vi.fn(() => Promise.resolve()),
    arrivals: vi.fn(() => Promise.resolve(state.arrivals)),
    admit: vi.fn<(d: unknown, a: unknown, g: DoorGrant) => Promise<void>>(() =>
      Promise.resolve(),
    ),
    pollReturn: vi.fn(
      (inbox: { inboxId: string }): Promise<ContactInvite | null> =>
        Promise.resolve(state.returns.get(inbox.inboxId) ?? null),
    ),
    knock: vi.fn(() => Promise.resolve()),
    redeem: vi.fn(
      (pointerId: string): Promise<DoorGrant | null> =>
        Promise.resolve(state.grants.get(pointerId) ?? null),
    ),
    sendReturn: vi.fn(() => Promise.resolve()),
  };
  return { door, state };
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
      peers: [{ key: "peer-alias", label: "Sam", badge: "blue" }],
      doorUrl: null,
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
        peers: [{ key: "peer-alias", label: "otter", badge: "blue" }],
        doorUrl: null,
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

  it("opens its door once linked and shows the door code", async () => {
    const { door } = fakeDoor();
    const { result } = renderHook(() => useLinkupFlow(deps({ door })));
    await waitFor(() => expect(result.current.phase.kind).toBe("showing"));
    expect(door.open).not.toHaveBeenCalled();
    act(() => result.current.onScanned(offer()));
    await waitFor(() =>
      expect(result.current.phase).toMatchObject({
        kind: "linked",
        doorUrl: "https://sti.care/d#p=door-1",
      }),
    );
  });

  it("admits an arrival and completes the leg when its return lands", async () => {
    const { door, state } = fakeDoor();
    const ingestReturn = vi.fn();
    const offers = [
      { contactId: "c1", url: "https://x/a/1#k=2" },
      { contactId: "fresh", url: realOfferUrl() },
    ];
    const d = deps({
      door,
      ingestReturn,
      createOffer: () =>
        Promise.resolve(
          offers.shift() ?? { contactId: "extra", url: realOfferUrl() },
        ),
    });
    const { result } = renderHook(() => useLinkupFlow(d));
    await waitFor(() => expect(result.current.phase.kind).toBe("showing"));
    act(() => result.current.onScanned(offer()));
    await waitFor(() => expect(door.open).toHaveBeenCalled());

    // A knock arrives: the holder mints a fresh bundle and seals it.
    state.arrivals = [{ requesterHash: "rh-1", pubKey: "pk-1" }];
    await waitFor(() => expect(door.admit).toHaveBeenCalledTimes(1));
    const grant = door.admit.mock.calls[0]?.[2];
    if (grant === undefined) throw new Error("expected the sealed grant");
    expect(grant.invite.alias.id).toHaveLength(43);

    // The joiner answers through the return channel; the holder ingests it and
    // the face appears.
    state.returns.set(grant.returnInbox.inboxId, {
      alias: { id: "joiner-alias", key: "jk" },
      notify: NOTIFY,
      ref: grant.invite.alias.id,
      sharedName: "Kim",
    });
    await waitFor(() => expect(ingestReturn).toHaveBeenCalled());
    await waitFor(() =>
      expect(result.current.phase).toMatchObject({
        kind: "linked",
        peers: [
          expect.objectContaining({ key: "peer-alias" }),
          expect.objectContaining({ key: "joiner-alias", label: "Kim" }),
        ],
      }),
    );
  });

  it("joins a scanned door: knock, redeem, accept, answer", async () => {
    const { door, state } = fakeDoor();
    const acceptGrant = vi.fn(() =>
      Promise.resolve({ contactId: "mine", url: "https://x/a/9#k=8&ref=z" }),
    );
    const d = deps({ door, acceptGrant });
    const { result } = renderHook(() => useLinkupFlow(d));
    await waitFor(() => expect(result.current.phase.kind).toBe("showing"));

    act(() =>
      result.current.onScanned({ kind: "door", pointerId: "their-door" }),
    );
    await waitFor(() => expect(door.knock).toHaveBeenCalledWith("their-door"));
    // Scanning the same door again is a no-op.
    act(() =>
      result.current.onScanned({ kind: "door", pointerId: "their-door" }),
    );
    expect(door.knock).toHaveBeenCalledTimes(1);

    // The holder admits: the grant appears; the joiner accepts and answers.
    const returnInbox = { inboxId: "ri", writeToken: "rw", key: "rk" };
    state.grants.set("their-door", {
      invite: {
        alias: { id: "holder-alias", key: "hk" },
        notify: NOTIFY,
        sharedName: "Ash",
      },
      returnInbox,
    });
    await waitFor(() => expect(acceptGrant).toHaveBeenCalled());
    await waitFor(() =>
      expect(door.sendReturn).toHaveBeenCalledWith(
        returnInbox,
        "https://x/a/9#k=8&ref=z",
      ),
    );
    await waitFor(() =>
      expect(result.current.phase).toMatchObject({
        kind: "linked",
        peers: [expect.objectContaining({ key: "holder-alias", label: "Ash" })],
      }),
    );
  });

  it("closing discards unanswered admissions and closes the door", async () => {
    const { door, state } = fakeDoor();
    const discard = vi.fn();
    const offers = [
      { contactId: "c1", url: "https://x/a/1#k=2" },
      { contactId: "fresh", url: realOfferUrl() },
    ];
    const d = deps({
      door,
      discard,
      createOffer: () =>
        Promise.resolve(
          offers.shift() ?? { contactId: "extra", url: realOfferUrl() },
        ),
    });
    const { result } = renderHook(() => useLinkupFlow(d));
    await waitFor(() => expect(result.current.phase.kind).toBe("showing"));
    act(() => result.current.onScanned(offer()));
    await waitFor(() => expect(door.open).toHaveBeenCalled());
    state.arrivals = [{ requesterHash: "rh-1", pubKey: "pk-1" }];
    await waitFor(() => expect(door.admit).toHaveBeenCalled());

    act(() => result.current.onClose());
    // The consumed offer stays; the unanswered admission is revoked; the door
    // closes with the screen.
    expect(discard).toHaveBeenCalledWith("fresh");
    expect(discard).not.toHaveBeenCalledWith("c1");
    expect(door.close).toHaveBeenCalled();
  });
});

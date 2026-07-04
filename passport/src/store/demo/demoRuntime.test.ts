import { describe, it, expect, vi, afterEach } from "vitest";
import {
  createDemoController,
  createDemoStore,
  DEMO_HANDLE,
} from "./demoRuntime.ts";
import { computeBadge } from "../../core/badge.ts";
import { todayEpochDay } from "../../core/clock.ts";
import type { GroupInvite } from "../groupInvite.ts";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function bootedSession() {
  const controller = createDemoController();
  const session = await controller.resumeFromStore();
  if (session === null) throw new Error("demo resumeFromStore returned null");
  return { controller, session };
}

describe("demo runtime", () => {
  it("boots a seeded @demo session via resumeFromStore", async () => {
    const { session } = await bootedSession();
    expect(session.blob.handle).toBe(DEMO_HANDLE);
    expect(session.blob.contacts.length).toBe(2);
  });

  it("seeds a blue badge anchored to today (ages with the wall clock)", async () => {
    const { session } = await bootedSession();
    expect(computeBadge(session.blob.state, todayEpochDay())).toBe("blue");
  });

  it("mutates in memory: report a state, add a contact", async () => {
    const { controller, session } = await bootedSession();
    const paused = await controller.setOwnerState(session, {
      ...session.blob.state,
      paused: true,
    });
    expect(paused.blob.state.paused).toBe(true);

    const added = await controller.createContactLink(paused, "Robin");
    expect(added.contact.label).toBe("Robin");
    expect(added.session.blob.contacts.map((c) => c.label)).toContain("Robin");
  });

  it("resolves any shared link to a canned peer and seeds one waiting request", async () => {
    const store = createDemoStore();
    const card = await store.resolveAlias({ id: "x", key: "y" });
    expect(card?.identity.handle).toBe("demo-friend");
    const pending = store.pendingRequests();
    expect(pending).toHaveLength(1);
    expect(pending[0]?.id).toBeTruthy();
  });

  it("seeds two-way contacts (a real exchanged connection, not half-linked)", async () => {
    const { session } = await bootedSession();
    for (const contact of session.blob.contacts) {
      expect(contact.theirStatusAlias).toBeDefined();
      expect(contact.theirNotify).toBeDefined();
    }
  });

  it("grants a knock: a grantable pending clears after approve", async () => {
    const { controller, session } = await bootedSession();
    const knocks = await controller.reviewKnocks(session);
    expect(knocks.count).toBe(1);
    expect(knocks.pending).toHaveLength(1);
    // Grant-shaped: a truthy pubKey, so the Approve button renders.
    expect(knocks.pending[0]?.pending.pubKey).toBeTruthy();

    // Approving the grant clears the row: a re-review returns nothing.
    expect(await controller.approveKnocks(session, knocks.pending)).toBe(1);
    const after = await controller.reviewKnocks(session);
    expect(after.count).toBe(0);
    expect(after.pending).toEqual([]);
  });

  it("resolves a viewer knock on the second redeem (scripted owner approves)", async () => {
    const store = createDemoStore();
    const id = store.pendingRequests()[0]?.id;
    if (id === undefined) throw new Error("expected a seeded request");
    // The scripted owner approves on the 2nd poll: null first, then the card.
    expect(await store.redeemGrant(id)).toBeNull();
    expect((await store.redeemGrant(id))?.identity.handle).toBe("demo-friend");
  });

  it("knock then redeem twice resolves any id to a card; forget drops it", async () => {
    const store = createDemoStore();
    // An un-knocked id fails closed to null.
    expect(await store.redeemGrant("peer-123")).toBeNull();
    await store.knock("peer-123");
    expect(await store.redeemGrant("peer-123")).toBeNull();
    expect((await store.redeemGrant("peer-123"))?.identity.handle).toBe(
      "demo-friend",
    );
    store.forgetRequest("peer-123");
    expect(store.pendingRequests().map((r) => r.id)).not.toContain("peer-123");
  });

  it("accepts a group invite as a member (adds one group, idempotent)", async () => {
    const { controller, session } = await bootedSession();
    const before = session.blob.groups?.length ?? 0;
    const invite: GroupInvite = {
      groupId: "g-invite",
      lifecycleInbox: { inboxId: "i", writeToken: "w", key: "k" },
      handle: "sunday_ride",
      visibility: "public",
      meetingKind: "recurring",
    };
    const joined = await controller.acceptGroupInvite(session, invite);
    const group = joined.blob.groups?.find((g) => g.groupId === "g-invite");
    expect(group?.isAdmin).toBe(false);
    expect(group?.handle).toBe("sunday_ride");
    expect(group?.meetingKind).toBe("recurring");
    expect(group?.lifecycleInbox).toBe(invite.lifecycleInbox);
    expect(joined.blob.groups?.length).toBe(before + 1);
    // Idempotent: accepting the same invite again adds nothing.
    const again = await controller.acceptGroupInvite(joined, invite);
    expect(again.blob.groups?.length).toBe(before + 1);
  });

  it("requests to join the discoverable group and is joined on redeem", async () => {
    const { controller, session } = await bootedSession();
    // Only the one discoverable handle resolves; any other stays not-found.
    expect(await controller.requestToJoin(session, "book_club")).toBe(
      "not-found",
    );
    expect(await controller.requestToJoin(session, "climbing_crew")).toBe(
      "requested",
    );

    const before = session.blob.groups?.length ?? 0;
    const joined = await controller.redeemJoinRequests(session);
    const group = joined.blob.groups?.find((g) => g.handle === "climbing_crew");
    expect(group?.isAdmin).toBe(false);
    expect(joined.blob.groups?.length).toBe(before + 1);
    // Idempotent: a second redeem adds nothing.
    const again = await controller.redeemJoinRequests(joined);
    expect(again.blob.groups?.length).toBe(before + 1);
  });

  it("makes no network call (the demo sends nothing)", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const { controller, session } = await bootedSession();
    const store = createDemoStore();
    await controller.setOwnerState(session, {
      ...session.blob.state,
      paused: true,
    });
    await controller.createContactLink(session, "X");
    await controller.shareLink(session);
    await store.resolveAlias({ id: "a", key: "b" });

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

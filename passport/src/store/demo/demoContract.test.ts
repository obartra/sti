import { describe, it, expect, vi, afterEach } from "vitest";
import {
  createDemoController,
  createDemoStore,
  DEMO_HANDLE,
} from "./demoRuntime.ts";
import { computeBadge } from "../../core/badge.ts";
import { todayEpochDay } from "../../core/clock.ts";
import type { OwnerSession, SessionController } from "../session.ts";
import type { PassportStore } from "../passportStore.ts";
import type { ContactInvite } from "../contactInvite.ts";
import type { GroupInvite } from "../groupInvite.ts";

/**
 * The demo CONTRACT (doc 28): an anti-staleness walk over the whole
 * SessionController + PassportStore surface. The demo already cannot fall out of
 * sync STRUCTURALLY (it implements the typed interfaces, so adding or renaming a
 * method is a compile error here). This pins the next layer: that every method
 * also BEHAVES, holding the mutate-and-persist invariant the real app depends on,
 * and that the entire surface stays off the network. So a refactor that quietly
 * turns a demo method into a no-op, or smuggles in a fetch, fails this test.
 */

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// A typed-but-inert contact invite. The demo ignores its contents (it mints a
// fresh local contact regardless), so placeholder ids satisfy the signature; this
// never reaches a parser or the network.
const INERT_INVITE: ContactInvite = {
  alias: { id: "demo-alias", key: "demo-key" },
  notify: {
    inboxId: "demo-inbox",
    writeToken: "demo-write",
    key: "demo-notify-key",
    routingToken: "demo-route",
  },
};

// A typed-but-inert group invite. The demo's accept/reject ignore its contents, so
// placeholder ids satisfy the signature; this never reaches a parser or the network.
const INERT_GROUP_INVITE: GroupInvite = {
  groupId: "demo-group",
  lifecycleInbox: {
    inboxId: "demo-inbox",
    writeToken: "demo-write",
    key: "demo-key",
  },
  handle: "book_club",
  visibility: "private",
  meetingKind: "event",
};

const URL_RE = /^https:\/\/sti\.care\/a\//;

// The shared-group membership surface (doc 33 slice 4a): invite records a pending
// invite and returns a group link; revoke drops it; accept/reject/poll/read/remove
// all round-trip to a session (the demo has no server, so the cross-party ingest is
// inert but must still behave). Split out to keep walkController under the complexity
// ceiling.
async function walkGroupMembership(
  controller: SessionController,
  session: OwnerSession,
  groupId: string,
): Promise<void> {
  const invited = await controller.inviteToGroup(session, groupId, {
    label: "Sam",
  });
  expect(invited.url).toMatch(/^https:\/\/sti\.care\/g/);
  const pend =
    invited.session.blob.groups?.find((g) => g.groupId === groupId)
      ?.pendingInvites ?? [];
  expect(pend).toHaveLength(1);
  expect(
    await controller.acceptGroupInvite(invited.session, INERT_GROUP_INVITE),
  ).not.toBeNull();
  expect(
    await controller.rejectGroupInvite(invited.session, INERT_GROUP_INVITE),
  ).not.toBeNull();
  expect(await controller.pollGroupLifecycle(invited.session)).not.toBeNull();
  const roster = await controller.readGroupRoster(invited.session, groupId);
  // A freshly created group's roster is just the creator (you); the seeded demo
  // group (demoGroupSeed) is where a fuller mixed-color roster shows.
  expect(roster.members).toHaveLength(1);
  expect(roster.members[0]?.isSelf).toBe(true);
  const firstPend = pend[0];
  if (firstPend === undefined) throw new Error("expected a pending invite");
  const unrevoked = await controller.revokeGroupInvite(
    invited.session,
    groupId,
    firstPend.inviteId,
  );
  expect(
    unrevoked.blob.groups?.find((g) => g.groupId === groupId)?.pendingInvites,
  ).toEqual([]);
  expect(
    await controller.removeGroupMember(unrevoked, groupId, "nobody"),
  ).not.toBeNull();
  await walkGroupJoin(controller, unrevoked, groupId);
}

// The shared-group REQUEST + LEAVE surface (doc 33 slice 4b): request finds nothing
// (the demo discovers no real public group), review returns no requests, and
// approve/reject/redeem round-trip inert; leave drops the group from the local blob.
// Split out to keep walkGroupMembership under the complexity ceiling.
async function walkGroupJoin(
  controller: SessionController,
  session: OwnerSession,
  groupId: string,
): Promise<void> {
  expect(await controller.requestToJoin(session, "book_club")).toBe(
    "not-found",
  );
  expect(await controller.reviewJoinRequests(session, groupId)).toEqual([]);
  const req = { requesterHash: "r", pubKey: "k" };
  expect(
    await controller.approveJoinRequest(session, groupId, req),
  ).not.toBeNull();
  expect(
    await controller.rejectJoinRequest(session, groupId, req),
  ).not.toBeNull();
  expect(await controller.redeemJoinRequests(session)).not.toBeNull();
  const left = await controller.leaveGroup(session, groupId);
  expect(left.blob.groups?.find((g) => g.groupId === groupId)).toBeUndefined();
}

// The grant-a-knock surface (doc 28 F): one grantable ask carrying a truthy pubKey,
// so Approve renders. Approving it returns the count granted and clears the row, so a
// re-review returns nothing (the "granted, gone from the queue" outcome). Split out to
// keep walkController under the complexity ceiling.
async function walkKnocks(
  controller: SessionController,
  session: OwnerSession,
): Promise<void> {
  const knocks = await controller.reviewKnocks(session);
  expect(knocks.count).toBe(1);
  expect(knocks.pending).toHaveLength(1);
  expect(knocks.pending[0]?.pending.pubKey).toBeTruthy();
  expect(
    await controller.approveKnocks(session, knocks.pending, "standing"),
  ).toBe(1);
  const cleared = await controller.reviewKnocks(session);
  expect(cleared.count).toBe(0);
  expect(cleared.pending).toEqual([]);
}

// The public-name surface (doc 17): a free name checks free and claims into the
// blob findables; the demo's reserved handle checks taken and refuses; a second
// claim of a now-held name is "unavailable"; releasing a held name drops it. Split
// out to keep walkController under the complexity ceiling.
async function walkFindables(
  controller: SessionController,
  session: OwnerSession,
): Promise<void> {
  expect(await controller.checkVanityName("robin")).toBe("free");
  expect(await controller.checkVanityName("demo")).toBe("taken");
  const vanity = await controller.registerVanityName(session, "robin");
  expect(vanity.result).toBe("registered");
  expect(vanity.session.blob.findables?.map((f) => f.name)).toContain("robin");
  const again = await controller.registerVanityName(vanity.session, "robin");
  expect(again.result).toBe("unavailable");
  const released = await controller.releaseVanityName(vanity.session, "robin");
  expect(released.blob.findables?.map((f) => f.name)).not.toContain("robin");
}

// Walk the whole SessionController surface in one realistic owner journey,
// asserting the mutate-and-persist contract: every owner action returns a session
// whose blob reflects the change, so the demo can never drift into a hollow
// stand-in that renders but does nothing.
async function walkController(controller: SessionController): Promise<void> {
  // Boot: silent resume lands on the seeded @demo account with a blue badge.
  const booted = await controller.resumeFromStore();
  if (booted === null) throw new Error("demo resumeFromStore returned null");
  expect(booted.blob.handle).toBe(DEMO_HANDLE);
  expect(booted.blob.contacts).toHaveLength(2);
  expect(computeBadge(booted.blob.state, todayEpochDay())).toBe("blue");

  // The phrase paths a real account also exposes: signUp mints a phrase + session;
  // recover returns a session; resume has no enrolled passkey in the demo, so it
  // reports the no-binding reason rather than a session.
  const signed = await controller.signUp();
  expect(signed.recoveryPhrase.length).toBeGreaterThan(0);
  expect(signed.session.blob.handle).toBe(DEMO_HANDLE);
  expect(await controller.recover("anything")).not.toBeNull();
  expect(await controller.resume()).toEqual({
    ok: false,
    reason: "no-binding",
  });

  // Device + passkey lifecycle: all resolve, persisting nothing.
  await controller.rememberDevice(booted);
  await controller.enrollPasskey("demo demo demo demo", "demo");
  await controller.forgetDevice();

  // Profile + state: each hands back a session whose blob carries the change.
  const profiled = await controller.setProfile(booted, {
    avatar: booted.blob.avatar,
  });
  expect(profiled.blob.avatar).toEqual(booted.blob.avatar);
  const paused = await controller.setOwnerState(profiled, {
    ...profiled.blob.state,
    paused: true,
  });
  expect(paused.blob.state.paused).toBe(true);
  expect(await controller.sweepExpiredLinks(paused)).not.toBeNull();

  // Sharing: both link paths return a real URL and a session.
  const shared = await controller.shareLink(paused);
  expect(shared.url).toMatch(URL_RE);
  const renewed = await controller.renewLink(shared.session);
  expect(renewed.url).toMatch(URL_RE);
  // Setting a lifetime resolves to a session (the demo has no server to enforce
  // an expiry, so it is inert but must still round-trip like the real method).
  expect(
    await controller.setShareLinkExpiry(renewed.session, null),
  ).not.toBeNull();

  // Inbox (doc 28 F, grant a knock), walked in its own helper.
  await walkKnocks(controller, renewed.session);

  // Contacts: create persists a durable link (no expiry), revoke drops it.
  const created = await controller.createContactLink(renewed.session, "Robin");
  expect(created.contact.label).toBe("Robin");
  expect(created.contact.expiresAt).toBeNull();
  expect(created.session.blob.contacts.map((c) => c.label)).toContain("Robin");
  const revoked = await controller.revokeContact(
    created.session,
    created.contact.id,
  );
  expect(revoked.blob.contacts.map((c) => c.id)).not.toContain(
    created.contact.id,
  );

  // Alias revoke (no public aliases seeded): a no-op that still returns a session.
  expect(await controller.revokeAlias(revoked, "unknown")).not.toBeNull();

  // Contact invites (doc 13 path A): accept records a real two-way contact, reading
  // the peer's own status alias + notify off the invite (not half-linked); ingesting a
  // return with no matching pending contact is a no-op that returns a session unchanged.
  const accepted = await controller.acceptContactInvite(
    revoked,
    INERT_INVITE,
    "Lee",
  );
  const lee = accepted.session.blob.contacts.find((c) => c.label === "Lee");
  expect(lee?.theirStatusAlias).toBe(INERT_INVITE.alias);
  expect(lee?.theirNotify).toBe(INERT_INVITE.notify);
  expect(
    await controller.ingestContactReturn(accepted.session, INERT_INVITE),
  ).not.toBeNull();

  // Partner-notify: the report fan-out and the recipient poll both resolve inert.
  expect(await controller.notifyContactsOfPositive(accepted.session)).toEqual({
    sent: [],
    skipped: [],
    failed: [],
  });
  expect(await controller.hasPartnerNudge(accepted.session)).toBe(false);

  // Circles: create / update / remove round-trip in the local blob.
  const circle = await controller.createCircle(accepted.session, "Close", []);
  expect(circle.session.blob.circles?.map((c) => c.id)).toContain(
    circle.circleId,
  );
  const renamed = await controller.updateCircle(
    circle.session,
    circle.circleId,
    "Closer",
    [],
  );
  expect(
    renamed.blob.circles?.find((c) => c.id === circle.circleId)?.name,
  ).toBe("Closer");
  const dropped = await controller.removeCircle(renamed, circle.circleId);
  expect(dropped.blob.circles?.map((c) => c.id)).not.toContain(circle.circleId);

  // Findable (doc 17), walked in its own helper: a free name claims into the blob,
  // a reserved name is "unavailable", releasing drops it. Public names really work.
  await walkFindables(controller, dropped);

  // Shared groups (doc 33): create records a group in the local blob and reports
  // the create outcome (a public handle "registered", a private one "created").
  const pubGroup = await controller.createGroup(dropped, {
    handle: "book_club",
    visibility: "public",
    meetingKind: "recurring",
  });
  expect(pubGroup.result).toBe("registered");
  expect(pubGroup.session.blob.groups?.map((g) => g.groupId)).toContain(
    pubGroup.groupId,
  );
  const privGroup = await controller.createGroup(pubGroup.session, {
    handle: "party_2026",
    visibility: "private",
    meetingKind: "event",
  });
  expect(privGroup.result).toBe("created");
  expect(
    privGroup.session.blob.groups?.find((g) => g.groupId === privGroup.groupId)
      ?.joinPointerId,
  ).toBeUndefined();

  // Shared-group membership (doc 33 slice 4a), walked in its own helper.
  await walkGroupMembership(controller, privGroup.session, privGroup.groupId);

  // Admin disband (doc 33): deleteGroup drops the group from the local blob, the
  // admin counterpart of the member leave walkGroupJoin covers.
  const disbanded = await controller.deleteGroup(
    privGroup.session,
    pubGroup.groupId,
  );
  expect(
    disbanded.blob.groups?.find((g) => g.groupId === pubGroup.groupId),
  ).toBeUndefined();

  // Passkey gate (doc 32): the demo enrolls no passkey, so the phrase re-view
  // gate reports none enrolled and a verify resolves false.
  expect(controller.passkeyEnrolled()).toBe(false);
  expect(await controller.verifyPasskey()).toBe(false);

  // Teardown: delete + forget resolve without error.
  await controller.deleteAccount(dropped);
  controller.forget();
}

// Walk the whole PassportStore read surface: any shared link resolves to the canned
// peer; an un-knocked grant fails closed to null; a knock then two redeems resolves to
// a card (the scripted owner approves on the 2nd poll); the seeded waiting request is
// listed and forgettable.
async function walkStore(store: PassportStore): Promise<void> {
  const card = await store.resolveAlias({ id: "x", key: "y" });
  expect(card?.identity.handle).toBe("demo-friend");
  // A fresh store seeds one waiting request (a peer the reviewer already asked to see).
  const seeded = store.pendingRequests();
  expect(seeded).toHaveLength(1);
  const first = seeded[0];
  if (first === undefined) throw new Error("expected a seeded request");
  // An un-knocked grant fails closed to null.
  expect(await store.redeemGrant("unknown-alias")).toBeNull();
  // Knock, then redeem twice: null on the first poll, the card on the second.
  await store.knock("any-alias");
  expect(await store.redeemGrant("any-alias")).toBeNull();
  expect((await store.redeemGrant("any-alias"))?.identity.handle).toBe(
    "demo-friend",
  );
  expect(await store.resolveVanityName("robin")).toBeNull();
  await store.reportVanityName("robin", "impersonation");
  store.forgetRequest(first.id);
  expect(store.pendingRequests().map((r) => r.id)).not.toContain(first.id);
}

describe("demo contract (anti-staleness)", () => {
  it("honors the full SessionController contract in one owner journey", async () => {
    await walkController(createDemoController());
  });

  it("honors the full PassportStore read contract", async () => {
    await walkStore(createDemoStore());
  });

  it("touches the network on no method across the entire surface", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await walkController(createDemoController());
    await walkStore(createDemoStore());
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

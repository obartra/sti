import { describe, it, expect, vi, afterEach } from "vitest";
import {
  createDemoController,
  createDemoStore,
  DEMO_HANDLE,
} from "./demoRuntime.ts";
import { computeBadge } from "../../core/badge.ts";
import { todayEpochDay } from "../../core/clock.ts";
import type { SessionController } from "../session.ts";
import type { PassportStore } from "../passportStore.ts";
import type { ContactInvite } from "../contactInvite.ts";

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

const URL_RE = /^https:\/\/sti\.care\/a\//;

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
    sharingMode: "public",
  });
  expect(profiled.blob.sharingMode).toBe("public");
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
  expect(
    await controller.setShareLinkDuration(renewed.session, 3_600_000),
  ).not.toBeNull();

  // Inbox: one contentless ask (a count with no grantable pending) and an approve
  // that honors however many it is handed.
  const knocks = await controller.reviewKnocks(renewed.session);
  expect(knocks.count).toBe(1);
  expect(knocks.pending).toEqual([]);
  expect(await controller.approveKnocks(renewed.session, [])).toBe(0);

  // Contacts: create persists, set-duration moves the expiry, revoke drops it.
  const created = await controller.createContactLink(renewed.session, "Robin");
  expect(created.contact.label).toBe("Robin");
  expect(created.session.blob.contacts.map((c) => c.label)).toContain("Robin");
  const dated = await controller.setContactDuration(
    created.session,
    created.contact.id,
    86_400_000,
  );
  expect(
    dated.blob.contacts.find((c) => c.id === created.contact.id)?.expiresAt,
  ).toBe(86_400_000);
  const revoked = await controller.revokeContact(dated, created.contact.id);
  expect(revoked.blob.contacts.map((c) => c.id)).not.toContain(
    created.contact.id,
  );

  // Alias revoke (no public aliases seeded): a no-op that still returns a session.
  expect(await controller.revokeAlias(revoked, "unknown")).not.toBeNull();

  // Contact invites (doc 13 path A): accept records a two-way contact; ingesting a
  // return is a no-op that returns a session.
  const accepted = await controller.acceptContactInvite(
    revoked,
    INERT_INVITE,
    "Lee",
  );
  expect(accepted.session.blob.contacts.map((c) => c.label)).toContain("Lee");
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

  // Findable: registration always reports "unavailable" (the demo claims no public
  // name); release is a no-op that returns a session.
  const vanity = await controller.registerVanityName(dropped, "robin");
  expect(vanity.result).toBe("unavailable");
  expect(await controller.releaseVanityName(dropped)).not.toBeNull();

  // Teardown: delete + forget resolve without error.
  await controller.deleteAccount(dropped);
  controller.forget();
}

// Walk the whole PassportStore read surface: any shared link resolves to the
// canned peer; the keyless / grant paths fail closed to null; the local request
// log is empty and forgettable.
async function walkStore(store: PassportStore): Promise<void> {
  const card = await store.resolveAlias({ id: "x", key: "y" });
  expect(card?.identity.handle).toBe("demo-friend");
  await store.knock("any-alias");
  expect(await store.redeemGrant("any-alias")).toBeNull();
  expect(await store.resolveVanityName("robin")).toBeNull();
  await store.reportVanityName("robin", "impersonation");
  expect(store.pendingRequests()).toEqual([]);
  store.forgetRequest("any-alias");
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

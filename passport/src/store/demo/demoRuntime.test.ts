import { describe, it, expect, vi, afterEach } from "vitest";
import {
  createDemoController,
  createDemoStore,
  DEMO_HANDLE,
} from "./demoRuntime.ts";
import { computeBadge } from "../../core/badge.ts";
import { todayEpochDay } from "../../core/clock.ts";

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

  it("resolves any shared link to a canned peer and holds no requests", async () => {
    const store = createDemoStore();
    const card = await store.resolveAlias({ id: "x", key: "y" });
    expect(card?.identity.handle).toBe("demo-friend");
    expect(store.pendingRequests()).toEqual([]);
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

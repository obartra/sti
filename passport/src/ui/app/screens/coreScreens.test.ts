// @vitest-environment node
import { describe, it, expect } from "vitest";
import { notificationItems, type KnockInbox } from "./coreScreens.tsx";

function inbox(over: Partial<KnockInbox> = {}): KnockInbox {
  return {
    canApprove: false,
    showInfo: false,
    approve: () => undefined,
    approving: false,
    ...over,
  };
}

function nudge(show = false): { show: boolean; dismiss: () => void } {
  return { show, dismiss: () => undefined };
}

describe("notificationItems (inbox privacy contract)", () => {
  it("shows the knock entry only when there is something to surface", () => {
    const none = notificationItems(inbox(), nudge(), () => undefined);
    expect(none.some((i) => i.icon === "users")).toBe(false);
    const info = notificationItems(
      inbox({ showInfo: true }),
      nudge(),
      () => undefined,
    );
    expect(info.some((i) => i.icon === "users")).toBe(true);
    const grant = notificationItems(
      inbox({ canApprove: true }),
      nudge(),
      () => undefined,
    );
    expect(grant.some((i) => i.icon === "users")).toBe(true);
  });

  it("a knock entry is contentless: no per-knock time, no count or requester in the text", () => {
    const cases: KnockInbox[] = [
      inbox({ showInfo: true }),
      inbox({ canApprove: true }),
      inbox({ canApprove: true, showInfo: true }),
    ];
    for (const c of cases) {
      const knock = notificationItems(c, nudge(), () => undefined).find(
        (i) => i.icon === "users",
      );
      expect(knock).toBeDefined();
      expect(knock?.when).toBeUndefined();
      expect(`${knock?.title} ${knock?.sub}`).not.toMatch(/\d/);
      expect(`${knock?.title} ${knock?.sub}`).not.toMatch(/@\w/);
    }
  });

  it("a grantable knock carries an Approve action; an info-only one carries none", () => {
    let approved = false;
    const grantable = notificationItems(
      inbox({ canApprove: true, approve: () => (approved = true) }),
      nudge(),
      () => undefined,
    ).find((i) => i.icon === "users");
    expect(grantable?.action?.label).toBe("Approve");
    grantable?.action?.onAct();
    expect(approved).toBe(true);
    // It is an action, not a navigation, so it never routes away to settings.
    expect(grantable?.onOpen).toBeUndefined();

    const infoOnly = notificationItems(
      inbox({ showInfo: true }),
      nudge(),
      () => undefined,
    ).find((i) => i.icon === "users");
    expect(infoOnly?.action).toBeUndefined();
    expect(infoOnly?.onOpen).toBeDefined();
  });

  it("a grantable knock takes precedence over the info row (only one users entry)", () => {
    const items = notificationItems(
      inbox({ canApprove: true, showInfo: true }),
      nudge(),
      () => undefined,
    ).filter((i) => i.icon === "users");
    expect(items).toHaveLength(1);
    expect(items[0]?.action?.label).toBe("Approve");
  });

  it("once nothing is grantable or info-worthy, the knock entry disappears", () => {
    // The state right after approving the only knock: canApprove flips off and
    // showInfo is false (no un-grantable knocks remain), so the row clears.
    const items = notificationItems(inbox(), nudge(), () => undefined);
    expect(items.some((i) => i.icon === "users")).toBe(false);
  });

  it("the busy flag flows into the action so the button can disable", () => {
    const item = notificationItems(
      inbox({ canApprove: true, approving: true }),
      nudge(),
      () => undefined,
    ).find((i) => i.icon === "users");
    expect(item?.action?.busy).toBe(true);
  });

  it("the standing re-test nudge is always present and carries no timestamp", () => {
    const retest = notificationItems(inbox(), nudge(), () => undefined).find(
      (i) => i.icon === "bell",
    );
    expect(retest).toBeDefined();
    expect(retest?.when).toBeUndefined();
  });

  it("surfaces the partner-notify row only when a contact reported, and it is contentless", () => {
    const absent = notificationItems(inbox(), nudge(false), () => undefined);
    expect(absent.some((i) => i.icon === "heart")).toBe(false);

    const present = notificationItems(inbox(), nudge(true), () => undefined);
    const row = present.find((i) => i.icon === "heart");
    expect(row).toBeDefined();
    // Contentless: it names no contact, carries no count or timestamp.
    expect(row?.when).toBeUndefined();
    expect(`${row?.title} ${row?.sub}`).not.toMatch(/\d/);
    expect(`${row?.title} ${row?.sub}`).not.toMatch(/@\w/);
    // It leads the inbox (most time-sensitive: PEP window).
    expect(present[0]?.icon).toBe("heart");
  });

  it("opening the partner-notify row routes to care and clears it for the session", () => {
    let dismissed = false;
    let routed: string | null = null;
    const row = notificationItems(
      inbox(),
      { show: true, dismiss: () => (dismissed = true) },
      (to) => (routed = to),
    ).find((i) => i.icon === "heart");
    row?.onOpen?.();
    expect(dismissed).toBe(true);
    expect(routed).toBe("care");
  });
});

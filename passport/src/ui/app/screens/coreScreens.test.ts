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

describe("notificationItems (inbox privacy contract)", () => {
  it("shows the knock entry only when there is something to surface", () => {
    const none = notificationItems(inbox(), () => undefined);
    expect(none.some((i) => i.icon === "users")).toBe(false);
    const info = notificationItems(inbox({ showInfo: true }), () => undefined);
    expect(info.some((i) => i.icon === "users")).toBe(true);
    const grant = notificationItems(
      inbox({ canApprove: true }),
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
      const knock = notificationItems(c, () => undefined).find(
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
      () => undefined,
    ).find((i) => i.icon === "users");
    expect(grantable?.action?.label).toBe("Approve");
    grantable?.action?.onAct();
    expect(approved).toBe(true);
    // It is an action, not a navigation, so it never routes away to settings.
    expect(grantable?.onOpen).toBeUndefined();

    const infoOnly = notificationItems(
      inbox({ showInfo: true }),
      () => undefined,
    ).find((i) => i.icon === "users");
    expect(infoOnly?.action).toBeUndefined();
    expect(infoOnly?.onOpen).toBeDefined();
  });

  it("a grantable knock takes precedence over the info row (only one users entry)", () => {
    const items = notificationItems(
      inbox({ canApprove: true, showInfo: true }),
      () => undefined,
    ).filter((i) => i.icon === "users");
    expect(items).toHaveLength(1);
    expect(items[0]?.action?.label).toBe("Approve");
  });

  it("once nothing is grantable or info-worthy, the knock entry disappears", () => {
    // The state right after approving the only knock: canApprove flips off and
    // showInfo is false (no un-grantable knocks remain), so the row clears.
    const items = notificationItems(inbox(), () => undefined);
    expect(items.some((i) => i.icon === "users")).toBe(false);
  });

  it("the busy flag flows into the action so the button can disable", () => {
    const item = notificationItems(
      inbox({ canApprove: true, approving: true }),
      () => undefined,
    ).find((i) => i.icon === "users");
    expect(item?.action?.busy).toBe(true);
  });

  it("the standing re-test nudge is always present and carries no timestamp", () => {
    const retest = notificationItems(inbox(), () => undefined).find(
      (i) => i.icon === "bell",
    );
    expect(retest).toBeDefined();
    expect(retest?.when).toBeUndefined();
  });
});

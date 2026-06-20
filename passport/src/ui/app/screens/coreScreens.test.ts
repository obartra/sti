// @vitest-environment node
import { describe, it, expect } from "vitest";
import { notificationItems } from "./coreScreens.tsx";

describe("notificationItems (inbox privacy contract)", () => {
  it("shows the knock entry only when someone has knocked", () => {
    const none = notificationItems(0, () => undefined);
    expect(none.some((i) => i.icon === "users")).toBe(false);
    const some = notificationItems(3, () => undefined);
    expect(some.some((i) => i.icon === "users")).toBe(true);
  });

  it("a knock entry is contentless: no per-knock time, no count in the text", () => {
    // Any positive count renders the SAME contentless entry: no timestamp field,
    // and the count never appears in the title/sub (no requester is named either).
    for (const n of [1, 2, 99]) {
      const knock = notificationItems(n, () => undefined).find(
        (i) => i.icon === "users",
      );
      expect(knock).toBeDefined();
      expect(knock?.when).toBeUndefined();
      expect(`${knock?.title} ${knock?.sub}`).not.toMatch(/\d/);
      expect(`${knock?.title} ${knock?.sub}`).not.toMatch(/@\w/);
    }
  });

  it("the standing re-test nudge is always present and carries no timestamp", () => {
    const retest = notificationItems(0, () => undefined).find(
      (i) => i.icon === "bell",
    );
    expect(retest).toBeDefined();
    expect(retest?.when).toBeUndefined();
  });
});

// @vitest-environment node
import { describe, it, expect } from "vitest";
import { deriveOwnerView } from "./ownerView.ts";
import { deriveOwnerCard } from "./ownerCard.ts";
import { INITIAL_OWNER_STATE, type OwnerState } from "../core/badge.ts";
import { NOW_DAY, daysAgo } from "../core/badge.fixtures.ts";
import { DEFAULT_AVATAR } from "../lib/avatars.ts";
import type { AccountBlob } from "./accountBlob.ts";

function blob(state: OwnerState, over: Partial<AccountBlob> = {}): AccountBlob {
  return {
    handle: "robin",
    aliases: [],
    contacts: [],
    state,
    avatar: DEFAULT_AVATAR,
    sharingMode: "link",
    ...over,
  };
}

// A tested, on-PrEP owner whose last panel was `ageDays` ago (as of NOW_DAY).
const tested = (
  ageDays = 10,
  over: Partial<OwnerState["testing"]> = {},
): OwnerState => ({
  ...INITIAL_OWNER_STATE,
  testing: {
    lastPanelDay: daysAgo(ageDays),
    corePanelComplete: true,
    exposedSitesCovered: true,
    ...over,
  },
  onPrep: true,
});

describe("deriveOwnerView", () => {
  it("a fresh, never-tested owner is gray with no freshness", () => {
    const v = deriveOwnerView(blob(INITIAL_OWNER_STATE), NOW_DAY);
    expect(v.badge).toBe("gray");
    expect(v.viewerBadge).toBe("gray");
    expect(v.labels).toEqual([]);
    expect(v.blueRoute).toBeNull();
    expect(v.daysLeft).toBe(0);
    expect(v.autoPaused).toBe(false);
    expect(v.lastTestedLabel).toBe("Never tested");
  });

  it("carries handle, avatar, and sharing mode straight through", () => {
    const avatar = { hair: 1, mood: 2, skin: 2, hairColor: 4, beard: 0 };
    const v = deriveOwnerView(
      blob(INITIAL_OWNER_STATE, {
        handle: "sam",
        avatar,
        sharingMode: "public",
      }),
      NOW_DAY,
    );
    expect(v.handle).toBe("sam");
    expect(v.avatar).toEqual(avatar);
    expect(v.sharingMode).toBe("public");
  });

  it("omits handle when none is set (no display name chosen at signup)", () => {
    const noHandle: AccountBlob = {
      aliases: [],
      contacts: [],
      state: INITIAL_OWNER_STATE,
      avatar: DEFAULT_AVATAR,
      sharingMode: "link",
    };
    const v = deriveOwnerView(noHandle, NOW_DAY);
    expect(v.handle).toBeUndefined();
  });

  it("a tested, on-PrEP owner is blue on the HIV umbrella route", () => {
    const v = deriveOwnerView(blob(tested(30)), NOW_DAY);
    expect(v.badge).toBe("blue");
    expect(v.labels).toEqual(["hiv"]);
    expect(v.blueRoute).toBe("hiv");
    expect(v.daysLeft).toBe(60); // 90 - 30
    expect(v.autoPaused).toBe(false);
    expect(v.lastTestedLabel).toBe("30 days ago");
  });

  it("matches the public card's badge, labels, and route (owner never disagrees with viewer)", () => {
    // Pin the invariant against deriveOwnerCard itself, not literals: if the
    // owner view stopped delegating, this fails.
    const state = tested(5);
    const v = deriveOwnerView(blob(state, { handle: "robin" }), NOW_DAY);
    const card = deriveOwnerCard(state, "robin", NOW_DAY);
    expect(v.badge).toBe(card.state);
    expect(v.labels).toEqual(card.labels ?? []);
    expect(v.blueRoute).toEqual(card.route ?? null);
  });

  it("treats the freshness window boundary the same as the badge core (age 90 vs 91)", () => {
    // The badge uses age <= 90: blue at 90, gray at 91. A freshness lapse is NOT
    // a clearance auto-pause (that is only a reported positive's window).
    const at90 = deriveOwnerView(blob(tested(90)), NOW_DAY);
    expect(at90.badge).toBe("blue"); // still in window
    expect(at90.autoPaused).toBe(false);
    expect(at90.daysLeft).toBe(0);

    const at91 = deriveOwnerView(blob(tested(91)), NOW_DAY);
    expect(at91.badge).toBe("gray"); // lapsed by one day
    expect(at91.autoPaused).toBe(false); // lapse grays, but is not auto-pause
    expect(at91.daysLeft).toBe(0);
  });

  it("a manual pause forces gray but keeps freshness context", () => {
    const v = deriveOwnerView(blob({ ...tested(20), paused: true }), NOW_DAY);
    expect(v.badge).toBe("gray");
    expect(v.paused).toBe(true);
    expect(v.autoPaused).toBe(false);
    expect(v.daysLeft).toBe(70);
  });

  it("a lapsed freshness window is gray (not auto-pause) with zero days left", () => {
    const v = deriveOwnerView(blob(tested(120)), NOW_DAY);
    expect(v.badge).toBe("gray"); // out of the 90-day window
    expect(v.autoPaused).toBe(false); // a lapse is not a clearance auto-pause
    expect(v.paused).toBe(false);
    expect(v.daysLeft).toBe(0); // clamped, not negative
    expect(v.lastTestedLabel).toBe("120 days ago");
  });

  it("labels the most recent test relative to today", () => {
    expect(deriveOwnerView(blob(tested(0)), NOW_DAY).lastTestedLabel).toBe(
      "Today",
    );
    expect(deriveOwnerView(blob(tested(1)), NOW_DAY).lastTestedLabel).toBe(
      "Yesterday",
    );
  });

  it("auto-pauses (clearance) with a clear-by date while a window is active", () => {
    // A reported positive's window is active: gray + autoPaused, distinct from a
    // manual pause, and the clear-by date reflects clearUntilDay.
    const state: OwnerState = { ...tested(5), clearUntilDay: NOW_DAY + 4 };
    const v = deriveOwnerView(blob(state), NOW_DAY);
    expect(v.badge).toBe("gray");
    expect(v.autoPaused).toBe(true);
    expect(v.paused).toBe(false);
    expect(v.clearBy.getTime()).toBe((NOW_DAY + 4) * 86_400_000);
  });
});

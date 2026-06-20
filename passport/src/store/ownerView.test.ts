// @vitest-environment node
import { describe, it, expect } from "vitest";
import { deriveOwnerView } from "./ownerView.ts";
import { deriveOwnerCard } from "./ownerCard.ts";
import { INITIAL_OWNER_STATE, type OwnerState } from "../core/badge.ts";
import { DEFAULT_AVATAR } from "../lib/avatars.ts";
import type { AccountBlob } from "./accountBlob.ts";

function blob(state: OwnerState, over: Partial<AccountBlob> = {}): AccountBlob {
  return {
    handle: "robin",
    aliases: [],
    state,
    avatar: DEFAULT_AVATAR,
    sharingMode: "link",
    ...over,
  };
}

const tested = (over: Partial<OwnerState["testing"]> = {}): OwnerState => ({
  ...INITIAL_OWNER_STATE,
  testing: {
    hasEverTested: true,
    lastPanelAgeDays: 10,
    corePanelComplete: true,
    exposedSitesCovered: true,
    ...over,
  },
  onPrep: true,
});

describe("deriveOwnerView", () => {
  it("a fresh, never-tested owner is gray with no freshness", () => {
    const v = deriveOwnerView(blob(INITIAL_OWNER_STATE));
    expect(v.badge).toBe("gray");
    expect(v.viewerBadge).toBe("gray");
    expect(v.labels).toEqual([]);
    expect(v.blueRoute).toBeNull();
    expect(v.daysLeft).toBe(0);
    expect(v.autoPaused).toBe(false);
    expect(v.lastTestedLabel).toBe("Never tested");
  });

  it("carries handle, avatar, and sharing mode straight through", () => {
    const avatar = { animal: 1, color: 2, hat: 0, glasses: 1, extra: 0 };
    const v = deriveOwnerView(
      blob(INITIAL_OWNER_STATE, {
        handle: "sam",
        avatar,
        sharingMode: "public",
      }),
    );
    expect(v.handle).toBe("sam");
    expect(v.avatar).toEqual(avatar);
    expect(v.sharingMode).toBe("public");
  });

  it("a tested, on-PrEP owner is blue on the HIV umbrella route", () => {
    const v = deriveOwnerView(blob(tested({ lastPanelAgeDays: 30 })));
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
    const state = tested({ lastPanelAgeDays: 5 });
    const v = deriveOwnerView(blob(state, { handle: "robin" }));
    const card = deriveOwnerCard(state, "robin");
    expect(v.badge).toBe(card.state);
    expect(v.labels).toEqual(card.labels ?? []);
    expect(v.blueRoute).toEqual(card.route ?? null);
  });

  it("treats the freshness window boundary the same as the badge core (age 90 vs 91)", () => {
    // The badge uses lastPanelAgeDays <= 90; autoPaused uses > 90. They must
    // agree exactly at the edge, so a future drift in either is caught here.
    const at90 = deriveOwnerView(blob(tested({ lastPanelAgeDays: 90 })));
    expect(at90.badge).toBe("blue"); // still in window
    expect(at90.autoPaused).toBe(false);
    expect(at90.daysLeft).toBe(0);

    const at91 = deriveOwnerView(blob(tested({ lastPanelAgeDays: 91 })));
    expect(at91.badge).toBe("gray"); // lapsed by one day
    expect(at91.autoPaused).toBe(true);
    expect(at91.daysLeft).toBe(0);
  });

  it("a manual pause forces gray but keeps freshness context", () => {
    const v = deriveOwnerView(
      blob({ ...tested({ lastPanelAgeDays: 20 }), paused: true }),
    );
    expect(v.badge).toBe("gray");
    expect(v.paused).toBe(true);
    expect(v.autoPaused).toBe(false);
    expect(v.daysLeft).toBe(70);
  });

  it("a lapsed freshness window auto-pauses to gray with zero days left", () => {
    const v = deriveOwnerView(blob(tested({ lastPanelAgeDays: 120 })));
    expect(v.badge).toBe("gray"); // out of the 90-day window
    expect(v.autoPaused).toBe(true);
    expect(v.paused).toBe(false);
    expect(v.daysLeft).toBe(0); // clamped, not negative
    expect(v.lastTestedLabel).toBe("120 days ago");
  });

  it("labels the most recent test relative to today", () => {
    expect(
      deriveOwnerView(blob(tested({ lastPanelAgeDays: 0 }))).lastTestedLabel,
    ).toBe("Today");
    expect(
      deriveOwnerView(blob(tested({ lastPanelAgeDays: 1 }))).lastTestedLabel,
    ).toBe("Yesterday");
  });
});

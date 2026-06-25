import { describe, it, expect } from "vitest";
import { livePassState, WALLET_FRESH_HOURS } from "./shared.tsx";

// A wallet pass must FAIL CLOSED to gray: blue is shown only when the owner is
// actually blue AND the pass reached the server AND the last confirmed read is
// inside the freshness window. Every other case yields the exact same "gray" a
// genuinely-gray owner yields, so a connection problem is indistinguishable from
// real gray (never a stale blue). This is a load-bearing privacy default; pin it
// directly rather than only through the Wallet component.
const FRESH_MS = (WALLET_FRESH_HOURS - 1) * 3.6e6;
const STALE_MS = WALLET_FRESH_HOURS * 3.6e6; // the cutoff is >=, so this is gray

describe("livePassState fail-closed-to-gray", () => {
  const now = 1_000_000_000_000;

  it("is blue only when blue + reachable + fresh", () => {
    expect(
      livePassState({
        ownerBadge: "blue",
        reachable: true,
        lastSyncAt: now - FRESH_MS,
        now,
      }),
    ).toBe("blue");
  });

  it("grays a stale read even when blue + reachable (boundary is inclusive)", () => {
    expect(
      livePassState({
        ownerBadge: "blue",
        reachable: true,
        lastSyncAt: now - STALE_MS,
        now,
      }),
    ).toBe("gray");
  });

  it("grays an unreachable pass even when blue + fresh (no stale blue offline)", () => {
    expect(
      livePassState({
        ownerBadge: "blue",
        reachable: false,
        lastSyncAt: now,
        now,
      }),
    ).toBe("gray");
  });

  it("grays a non-blue (gray) owner even when reachable + fresh", () => {
    expect(
      livePassState({
        ownerBadge: "gray",
        reachable: true,
        lastSyncAt: now,
        now,
      }),
    ).toBe("gray");
  });
});

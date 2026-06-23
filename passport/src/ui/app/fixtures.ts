import { randomAvatar } from "../../lib/avatars.ts";
import type { OwnerView } from "../../store/index.ts";

// The demo owner the wired app runs on in Storybook and as the logged-out
// placeholder. A coherent blue owner: tested in window, clear, on an
// HIV-prevention route, public alias. The real app derives this same OwnerView
// shape from the account blob via deriveOwnerView; this is the fixture binding.
export const OWNER: OwnerView = {
  handle: "robin",
  // seed 2 keeps the rendered avatar byte-identical to the prior avatarId: 2.
  avatar: randomAvatar(2),
  badge: "blue",
  viewerBadge: "blue",
  labels: ["hiv"],
  blueRoute: "hiv",
  sharingMode: "public",
  paused: false,
  autoPaused: false,
  // Not in a clearance window (autoPaused is false), so this is never rendered;
  // a fixed date keeps the fixture deterministic.
  clearBy: new Date("2026-06-27T00:00:00Z"),
  daysLeft: 62,
  lastTestedLabel: "7 Jun 2026",
};

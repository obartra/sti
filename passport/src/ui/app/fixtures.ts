import type {
  BadgeState,
  ProtectionLabel,
  Route as BadgeRoute,
} from "../badge-card.tsx";

// The demo owner the wired app runs on (local fixtures, no backend). A coherent
// blue owner: tested in window, clear, on an HIV-prevention route, public alias.
// Stands in for the prototype's derived tweak state until the backend is wired.
export interface OwnerFixture {
  handle: string;
  avatarId: number;
  badge: BadgeState;
  viewerBadge: BadgeState;
  labels: ProtectionLabel[];
  blueRoute: BadgeRoute;
  sharingMode: "public" | "link";
  paused: boolean;
  autoPaused: boolean;
  daysLeft: number;
  lastTestedLabel: string;
}

export const OWNER: OwnerFixture = {
  handle: "robin",
  avatarId: 2,
  badge: "blue",
  viewerBadge: "blue",
  labels: ["hiv"],
  blueRoute: "hiv",
  sharingMode: "public",
  paused: false,
  autoPaused: false,
  daysLeft: 62,
  lastTestedLabel: "7 Jun 2026",
};

// A sample blue card shown for the "see what others see" / public-resolution
// preview (a different person, so it never leaks the owner's own data).
export const SAMPLE_RESOLVED = {
  state: "blue" as BadgeState,
  labels: ["hiv", "condoms_always"] as ProtectionLabel[],
  route: "hiv" as BadgeRoute,
  identity: { handle: "sam" },
};

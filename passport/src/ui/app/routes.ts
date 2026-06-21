// The screen graph, ported from the prototype's main.jsx (screen ids, groups,
// and the bottom-tab set). Every navigable screen has an id here.

import type { NotifyCapability } from "../../store/index.ts";

export const ALL_SCREENS = [
  "a1-landing",
  "a2-public",
  "a3-alert",
  "exposed",
  "b1-claim",
  "b2-recovery",
  "b3-setup",
  "home",
  "connect",
  "linkup",
  "scan-link",
  "alias-share",
  "wallet",
  "results",
  "care",
  "notifications",
  "avatar-edit",
  "learn",
  "learn-detail",
  "learn-uu",
  "circles",
  "circle-create",
  "circle-join",
  "circle-approvals",
  "circle-detail",
  "circle-manage",
  "circle-leave",
  "report",
  "report-saved",
  "privacy",
] as const;

export type Screen = (typeof ALL_SCREENS)[number];

export function isScreen(s: string): s is Screen {
  return (ALL_SCREENS as readonly string[]).includes(s);
}

export type Group = "public" | "onboard" | "app";

// Extra payload a navigation can carry (an article id, a circle id, the
// login/self/preview flags). Kept loose; each screen reads only what it needs.
export interface RouteData {
  id?: string;
  // The alias decryption key from a shared link's `#k=` fragment (a2-public).
  key?: string;
  // A contact invite's extra fragment (doc 13 path A): the inviter's notify
  // capability and, on a return invite, the inviter's alias id being answered.
  notify?: NotifyCapability;
  ref?: string;
  isLogin?: boolean;
  self?: boolean;
  preview?: boolean;
}

export interface Route {
  screen: Screen;
  group: Group;
  data: RouteData | null;
}

const PUBLIC: readonly Screen[] = ["a1-landing", "a2-public", "exposed"];
const ONBOARD: readonly Screen[] = ["b1-claim", "b2-recovery", "b3-setup"];

// The bottom tab bar (mobile) / sidebar (desktop) destinations.
export const TABS = ["home", "connect", "circles", "results", "care"] as const;
export type Tab = (typeof TABS)[number];

export function groupOf(screen: Screen): Group {
  if (PUBLIC.includes(screen)) return "public";
  if (ONBOARD.includes(screen)) return "onboard";
  return "app";
}

export function isTab(screen: Screen): screen is Tab {
  return (TABS as readonly string[]).includes(screen);
}

// Which tab "owns" a given app screen, so a sub-screen keeps the right nav item
// lit. Ported from the prototype's SECTION map.
const SECTION: Partial<Record<Screen, Tab>> = {
  report: "home",
  "report-saved": "home",
  privacy: "home",
  notifications: "home",
  wallet: "home",
  "avatar-edit": "home",
  "a3-alert": "home",
  linkup: "connect",
  "scan-link": "connect",
  "alias-share": "connect",
  "circle-create": "circles",
  "circle-join": "circles",
  "circle-approvals": "circles",
  "circle-detail": "circles",
  "circle-manage": "circles",
  "circle-leave": "circles",
  learn: "care",
  "learn-detail": "care",
  "learn-uu": "care",
};

export function sectionOf(screen: Screen): Tab {
  if (isTab(screen)) return screen;
  return SECTION[screen] ?? "home";
}

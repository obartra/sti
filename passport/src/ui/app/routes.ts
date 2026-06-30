// The screen graph, ported from the prototype's main.jsx (screen ids, groups,
// and the bottom-tab set). Every navigable screen has an id here.

import type { NotifyCapability } from "../../store/index.ts";

const ALL_SCREENS = [
  "a1-landing",
  "a2-public",
  "a3-alert",
  "exposed",
  "u-resolve",
  "requests",
  "b1-claim",
  "b2-recovery",
  "b3-setup",
  "home",
  "connect",
  "alias-share",
  "scan",
  "wallet",
  "care",
  "notifications",
  "avatar-edit",
  "learn",
  "learn-detail",
  "learn-uu",
  "groups",
  "group-create",
  "group-detail",
  "report",
  "report-saved",
  "privacy",
  "promises",
  "privacy-policy",
  "terms",
  "share-link",
] as const;

export type Screen = (typeof ALL_SCREENS)[number];

export function isScreen(s: string): s is Screen {
  return (ALL_SCREENS as readonly string[]).includes(s);
}

export type Group = "public" | "onboard" | "app";

// Extra payload a navigation can carry (an article id, a group id, the
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
  // The vanity name being resolved (u-resolve, Findable doc 17).
  name?: string;
}

export interface Route {
  screen: Screen;
  group: Group;
  data: RouteData | null;
}

const PUBLIC: readonly Screen[] = [
  "a1-landing",
  "a2-public",
  "exposed",
  "u-resolve",
  "requests",
  // The trust pages are full-page static content, reachable logged out from the
  // landing footer (doc 23), so they live in the public group, not the app shell.
  "promises",
  "privacy-policy",
  "terms",
  "share-link",
];
const ONBOARD: readonly Screen[] = ["b1-claim", "b2-recovery", "b3-setup"];

// The bottom tab bar (mobile) / sidebar (desktop) destinations.
const TABS = ["home", "connect", "groups", "care"] as const;
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
  "alias-share": "connect",
  "group-create": "groups",
  "group-detail": "groups",
  learn: "care",
  "learn-detail": "care",
  "learn-uu": "care",
};

export function sectionOf(screen: Screen): Tab {
  if (isTab(screen)) return screen;
  return SECTION[screen] ?? "home";
}

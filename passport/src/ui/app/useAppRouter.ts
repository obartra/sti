import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  groupOf,
  type Group,
  type Route,
  type RouteData,
  type Screen,
} from "./routes.ts";
import { applyPendingUpdate } from "../../pwa/swUpdate.ts";
import { parseAliasLink, aliasIdFromPath } from "../../store/aliasLink.ts";
import { parseContactInvite } from "../../store/contactInvite.ts";
import { normalizeVanityName } from "../../store/vanityName.ts";

export interface Nav {
  // Navigate to a screen, pushing the current one onto the history stack.
  go: (screen: Screen, data?: RouteData) => void;
  // Pop back to the previous screen (or home when the stack is empty).
  back: () => void;
  // Jump to a top-level destination, resetting history (the tab/sidebar action).
  jump: (screen: Screen, group?: Group) => void;
}

export interface Router {
  route: Route;
  nav: Nav;
  shareOpen: boolean;
  setShareOpen: (open: boolean) => void;
}

const HOME: Route = { screen: "home", group: "app", data: null };
const START: Route = { screen: "a1-landing", group: "public", data: null };

// Extract the vanity name from a `/u/{name}` path (doc 17), or null if the path
// isn't one. Decoding is fail-closed: a malformed percent-encoding falls back to
// the raw segment rather than throwing during render (resolve then 404s → the
// not-found screen). Exported for testing.
export function findableNameFromPath(pathname: string): string | null {
  const raw = /^\/u\/([^/]+)\/?$/.exec(pathname)?.[1];
  if (raw === undefined) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }
  return normalizeVanityName(decoded);
}

// The fixed clean path each non-parameterized screen owns. The id-carrying screens
// are not here; they build a path param from route data (`paramPath`): `a2-public`
// (`/a/{id}#k=`), `u-resolve` (`/u/{name}`), `group-detail` (`/groups/{id}`),
// `group-create` edit (`/groups/{id}/edit`), `learn-detail` (`/care/learn/{id}`).
// The two "privacy" surfaces resolve their old naming clash here: the Settings
// screen (id `privacy`) is `/settings`, the privacy POLICY page (id
// `privacy-policy`) is `/privacy`.
const SCREEN_PATH: Partial<Record<Screen, string>> = {
  "a1-landing": "/",
  "a3-alert": "/alert",
  exposed: "/exposed",
  requests: "/requests",
  "b1-claim": "/claim",
  "b2-recovery": "/recovery",
  "b3-setup": "/setup",
  home: "/home",
  links: "/links",
  people: "/people",
  "alias-share": "/links/share",
  scan: "/people/scan",
  wallet: "/wallet",
  care: "/care",
  notifications: "/notifications",
  "avatar-edit": "/avatar",
  learn: "/care/learn",
  "learn-uu": "/care/learn/uu",
  groups: "/groups",
  "group-create": "/groups/new",
  report: "/report",
  "report-saved": "/report/saved",
  privacy: "/settings",
  promises: "/promises",
  "privacy-policy": "/privacy",
  terms: "/terms",
  "share-link": "/share-link",
};

// The reverse lookup (path -> screen), built once from the single SCREEN_PATH source.
const PATH_SCREEN: Record<string, Screen> = {};
for (const screen of Object.keys(SCREEN_PATH) as Screen[]) {
  const path = SCREEN_PATH[screen];
  if (path !== undefined) PATH_SCREEN[path] = screen;
}

// The path an id-carrying screen builds from its route data, or null when the screen
// has no param (or the datum is missing): `/u/{name}`, `/groups/{id}`,
// `/groups/{id}/edit`, `/care/learn/{id}`.
function paramPath(screen: Screen, data: RouteData | null): string | null {
  if (data === null) return null;
  if (screen === "u-resolve" && data.name) {
    return `/u/${encodeURIComponent(data.name)}`;
  }
  if (screen === "group-create" && data.id) return `/groups/${data.id}/edit`;
  if (screen === "group-detail" && data.id) return `/groups/${data.id}`;
  if (screen === "learn-detail" && data.id) return `/care/learn/${data.id}`;
  return null;
}

// The canonical URL a screen normalizes to: its id-carrying path param when it has
// one, else the fixed clean path from the table.
function canonicalUrl(screen: Screen, data?: RouteData | null): string {
  return (
    paramPath(screen, data ?? null) ?? SCREEN_PATH[screen] ?? `/#${screen}`
  );
}

// The canonical clean path a screen normalizes to, exported so the trust links can
// render as real anchors (href + the SPA intercept) rather than `/#...` buttons.
export const pathForScreen = canonicalUrl;

// The transient screens that depend on in-memory state and so cannot be deep-linked
// cold: hitting their path on a refresh redirects to a safe fallback instead of
// rendering an empty shell. (The in-flow navigation still pushes their path; only a
// cold re-derive is redirected, after which mount normalizes the URL.)
const COLD_REDIRECT: Record<string, Screen> = {
  "/recovery": "b1-claim",
  "/setup": "b1-claim",
  "/report/saved": "home",
};

// Legacy paths kept working so an installed PWA (or an old shortcut/bookmark) never
// strands: the old Connect tab and its sub-paths now live under People / Links.
// A cold hit resolves to the new screen and mount normalizes the URL.
const LEGACY_REDIRECT: Record<string, Screen> = {
  "/connect": "people",
  "/connect/scan": "scan",
  "/connect/share": "alias-share",
};

// The id-carrying app paths: `/groups/{id}`, `/groups/{id}/edit`,
// `/care/learn/{id}`. Checked after the exact table so `/groups/new` and
// `/care/learn/uu` (real screens) are not mistaken for ids.
function pathParamRoute(cleanPath: string): Route | null {
  const edit = /^\/groups\/([^/]+)\/edit$/.exec(cleanPath)?.[1];
  if (edit) return { screen: "group-create", group: "app", data: { id: edit } };
  const circle = /^\/groups\/([^/]+)$/.exec(cleanPath)?.[1];
  if (circle)
    return { screen: "group-detail", group: "app", data: { id: circle } };
  const article = /^\/care\/learn\/([^/]+)$/.exec(cleanPath)?.[1];
  if (article)
    return { screen: "learn-detail", group: "app", data: { id: article } };
  return null;
}

// A real shared passport link is `/a/{id}#k={key}` (the SPA fallback serves the
// app at that path). It resolves to a2-public carrying the id + key; the hash
// here holds the decryption key, not a screen name. Returns null when the path is
// not an alias link.
function aliasRoute(pathname: string, hash: string): Route | null {
  const link = parseAliasLink(pathname, hash);
  if (link) {
    const invite = parseContactInvite(pathname, hash);
    return {
      screen: "a2-public",
      group: "public",
      data: {
        id: link.id,
        key: link.key,
        ...(invite ? { notify: invite.notify } : {}),
        ...(invite?.ref !== undefined ? { ref: invite.ref } : {}),
      },
    };
  }
  const keylessId = aliasIdFromPath(pathname);
  if (keylessId !== null) {
    return { screen: "a2-public", group: "public", data: { id: keylessId } };
  }
  return null;
}

// The id-carrying links whose data lives in the URL: a `/u/{name}` findable link
// (doc 17) and a `/a/{id}#k=` shared alias link (id in path, key in the
// fragment). Returns null when the location is neither.
function parameterizedRoute(pathname: string, hash: string): Route | null {
  const name = findableNameFromPath(pathname);
  if (name !== null) {
    return { screen: "u-resolve", group: "public", data: { name } };
  }
  return aliasRoute(pathname, hash);
}

// Derive the current route from the URL, in priority order: an id-carrying link
// (above), then the clean-path table (every non-parameterized screen). Every screen
// now owns a clean path, so a legacy `/#screen` hash is no longer read: a stale
// `/#home` bookmark falls through to the bare-root entry (the landing) and mount
// normalization strips the hash. The `#k=` fragment on an alias link is handled by
// parameterizedRoute above, not here, so dropping the hash read never touches it.
export function routeFromLocation(): Route | null {
  if (typeof window === "undefined") return null;
  const { pathname, hash } = window.location;
  const param = parameterizedRoute(pathname, hash);
  if (param) return param;
  const cleanPath = pathname.replace(/\/$/, "") || "/";
  const redirect = COLD_REDIRECT[cleanPath] ?? LEGACY_REDIRECT[cleanPath];
  if (redirect)
    return { screen: redirect, group: groupOf(redirect), data: null };
  const screen = PATH_SCREEN[cleanPath];
  if (screen !== undefined)
    return { screen, group: groupOf(screen), data: null };
  return pathParamRoute(cleanPath);
}

// Whether a screen owns its URL and must not be normalized away at mount: a shared
// alias link (`/a/{id}` keyed OR keyless — rewriting it would clobber the `#k=` key
// or drop the id), the public `/exposed` page, and a `/u/{name}` findable link (its
// name lives in the path, not route state). The id-less a2-public ("see a sample" /
// self-preview) carries no address, so it is not owned and normalizes to the root.
function ownsUrl(route: Route): boolean {
  if (route.screen === "exposed") return true;
  if (route.screen === "u-resolve") return true;
  return route.screen === "a2-public" && route.data?.id != null;
}

// Write the canonical URL for a screen, pushing a new history entry or replacing the
// current one. Returns whether a push actually happened (it is a no-op when the URL
// already matches), so the caller can keep its app-pushed depth count honest.
function syncUrl(
  screen: Screen,
  data: RouteData | null | undefined,
  mode: "push" | "replace",
): boolean {
  const target = canonicalUrl(screen, data);
  if (window.location.pathname + window.location.hash === target) return false;
  if (mode === "push") {
    window.history.pushState(null, "", target);
    return true;
  }
  window.history.replaceState(null, "", target);
  return false;
}

export function useAppRouter(initial: Route = START): Router {
  const [route, setRoute] = useState<Route>(
    () => routeFromLocation() ?? initial,
  );
  const [shareOpen, setShareOpen] = useState(false);
  // The browser History is the single source of truth for back: every forward
  // `go` pushes one entry, `jump` (a tab switch) replaces, and `back` is just
  // `history.back()`. `depth` counts the entries this app pushed since mount, so
  // `back` knows when there is somewhere of ours to return to versus when it would
  // step off the site (a cold deep-link), in which case it falls home instead.
  const depth = useRef(0);

  // Mount-only URL normalization: replace the URL the app loaded at (e.g. a stale
  // `/#a1-landing`, or a bare `/home`) with its canonical form, never pushing, so the
  // user is never one extra Back press from leaving. Owned-URL screens are left
  // exactly as loaded. After mount, `go`/`jump` own every URL write directly, so this
  // never runs again (guarded on firstUrlSync).
  const firstUrlSync = useRef(true);
  useEffect(() => {
    if (!firstUrlSync.current) return;
    firstUrlSync.current = false;
    if (ownsUrl(route)) return;
    syncUrl(route.screen, route.data, "replace");
  }, [route]);

  // The browser back/forward buttons (and swipe gestures) change the URL without a
  // page load; re-derive the route from the new location so the app actually moves.
  // Any backward step decrements our pushed-entry count (floored at 0); forward steps
  // are not surfaced anywhere in the UI, so they are not separately tracked.
  useEffect(() => {
    const onPop = () => {
      depth.current = Math.max(0, depth.current - 1);
      // The bare root resolves to the landing (routeFromLocation returns null there),
      // mirroring the mount-time `routeFromLocation() ?? initial`.
      setRoute(routeFromLocation() ?? initial);
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
    };
  }, [initial]);

  // Silent PWA update (doc 22 section E): when a newer worker is waiting, adopt it at
  // the user's next screen change, never mid-interaction. Skips the initial mount, so
  // it only fires on a real navigation; a no-op unless an update is actually waiting.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    applyPendingUpdate();
  }, [route.screen]);

  const go = useCallback((screen: Screen, data?: RouteData) => {
    // A real forward navigation: push exactly one history entry (no-op if we are
    // already at that URL), then show the screen.
    if (syncUrl(screen, data, "push")) depth.current += 1;
    setRoute({ screen, group: groupOf(screen), data: data ?? null });
  }, []);

  const back = useCallback(() => {
    if (depth.current > 0) {
      // We pushed at least one entry of our own: let the browser pop it. The
      // popstate listener decrements depth and re-derives the route, so back can
      // never disagree with the URL (the old in-app-stack-vs-URL divergence).
      window.history.back();
    } else {
      // Nothing of ours behind us (a cold deep-link): fall home rather than step
      // off the site. Replace so a later Back still leaves cleanly.
      syncUrl("home", null, "replace");
      setRoute(HOME);
    }
  }, []);

  const jump = useCallback((screen: Screen, group?: Group) => {
    // Tabs / sidebar destinations are siblings, not a drill-down, so replace rather
    // than push: Back never walks sideways through tabs. This becomes the new root
    // of the session, so the app-pushed depth resets to zero.
    syncUrl(screen, null, "replace");
    depth.current = 0;
    setRoute({ screen, group: group ?? groupOf(screen), data: null });
  }, []);

  const nav = useMemo<Nav>(() => ({ go, back, jump }), [go, back, jump]);

  return { route, nav, shareOpen, setShareOpen };
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  groupOf,
  isScreen,
  type Group,
  type Route,
  type RouteData,
  type Screen,
} from "./routes.ts";
import { applyPendingUpdate } from "../../pwa/swUpdate.ts";
import { parseAliasLink, aliasIdFromPath } from "../../store/aliasLink.ts";
import { parseContactInvite } from "../../store/contactInvite.ts";
import { normalizeVanityName } from "../../store/vanityName.ts";
import { FINDABLE_ENABLED } from "../../features.ts";

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

// The canonical URL a screen normalizes to. Most screens are hash-routed off the
// root (`/#home`), but a few public surfaces own a clean path: the landing IS the
// root `/` (so visiting sti.care does not bounce to `/#a1-landing`), and `/promises`
// is its own anonymous-reachable page. `/exposed` and a real `/a/{id}` link are left
// untouched by the caller, so they are not handled here.
function canonicalUrl(screen: Screen): string {
  if (screen === "a1-landing") return "/";
  if (screen === "promises") return "/promises";
  return `/#${screen}`;
}

// A screen can be deep-linked via the URL hash (#wallet, #circle-detail). Used
// for internal shareable links and for the per-screen capture sweep.
function routeFromHash(): Route | null {
  if (typeof window === "undefined") return null;
  const id = window.location.hash.replace(/^#\/?/, "");
  return isScreen(id) ? { screen: id, group: groupOf(id), data: null } : null;
}

// A real shared passport link is `/a/{id}#k={key}` (the SPA fallback serves the
// app at that path). It resolves to a2-public carrying the id + key; the hash
// here holds the decryption key, not a screen name.
export function routeFromLocation(): Route | null {
  if (typeof window === "undefined") return null;
  // The public heads-up page (linked from the off-app text). Anonymous, no key.
  if (/^\/exposed\/?$/.test(window.location.pathname)) {
    return { screen: "exposed", group: "public", data: null };
  }
  // The public promises page owns /promises (the in-app, test-backed guarantees,
  // not a separate static report). Anonymous-reachable, like /exposed.
  if (/^\/promises\/?$/.test(window.location.pathname)) {
    return { screen: "promises", group: "public", data: null };
  }
  // A Findable name link `/u/{name}` (doc 17). Gated until launch; when on, route
  // to the resolve step, which looks the name up and hands into the knock flow (a
  // findable name carries no key, so it's the keyless gated path).
  if (FINDABLE_ENABLED) {
    const name = findableNameFromPath(window.location.pathname);
    if (name !== null) {
      return { screen: "u-resolve", group: "public", data: { name } };
    }
  }
  return aliasRoute(window.location.pathname, window.location.hash);
}

// Resolve a shared alias link to its a2-public route, or fall through to hash
// routing. A keyed `/a/{id}#k=` carries the decryption key (and maybe a contact
// invite); a keyless `/a/{id}` is a gated "ask first" share (doc 16) that still
// routes to a2-public so the viewer gets the ask-to-view flow rather than the
// landing. A non-existent id resolves to the same gray-nothing, so neither leaks
// whether the link exists.
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
  return routeFromHash();
}

export function useAppRouter(initial: Route = START): Router {
  const [route, setRoute] = useState<Route>(
    () => routeFromLocation() ?? initial,
  );
  const [, setHistory] = useState<Route[]>([]);
  const [shareOpen, setShareOpen] = useState(false);

  // Reflect the current screen in the URL hash so it is shareable and
  // refresh-stable, without polluting browser history. While actually showing a
  // shared link (a2-public carrying an id, keyed OR keyless), leave the URL alone:
  // rewriting it would clobber the `#k=` key on a keyed link and drop the id on a
  // keyless one, and the `/a/{id}` URL is already the canonical shareable address.
  // The id-less a2-public (the "see a sample" demo, or a self-preview) carries no
  // address, so it normalizes back to the hash-routed root like any other screen.
  useEffect(() => {
    const onAliasLink = route.screen === "a2-public" && route.data?.id != null;
    // Leave the canonical public /exposed URL alone too (it is the shared link).
    if (onAliasLink || route.screen === "exposed") return;
    // The landing owns the clean root `/` and promises owns `/promises`; everything
    // else is hash-routed off the root.
    const target = canonicalUrl(route.screen);
    if (window.location.pathname + window.location.hash !== target) {
      window.history.replaceState(null, "", target);
    }
  }, [route.screen, route.data]);

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

  const go = useCallback(
    (screen: Screen, data?: RouteData) => {
      setHistory((h) => [...h, route]);
      setRoute({ screen, group: groupOf(screen), data: data ?? null });
    },
    [route],
  );

  const back = useCallback(() => {
    setHistory((h) => {
      const prev = h[h.length - 1];
      setRoute(prev ?? HOME);
      return h.slice(0, -1);
    });
  }, []);

  const jump = useCallback((screen: Screen, group?: Group) => {
    setHistory([]);
    setRoute({ screen, group: group ?? groupOf(screen), data: null });
  }, []);

  const nav = useMemo<Nav>(() => ({ go, back, jump }), [go, back, jump]);

  return { route, nav, shareOpen, setShareOpen };
}

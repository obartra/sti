import { useCallback, useEffect, useMemo, useState } from "react";
import {
  groupOf,
  isScreen,
  type Group,
  type Route,
  type RouteData,
  type Screen,
} from "./routes.ts";
import { parseAliasLink } from "../../store/aliasLink.ts";

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
function routeFromLocation(): Route | null {
  if (typeof window === "undefined") return null;
  const link = parseAliasLink(window.location.pathname, window.location.hash);
  if (link) {
    return {
      screen: "a2-public",
      group: "public",
      data: { id: link.id, key: link.key },
    };
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
  // refresh-stable, without polluting browser history. Skipped on a real shared
  // link (/a/{id}#k=...): rewriting the hash would clobber the decryption key,
  // and that URL is already the canonical shareable one.
  useEffect(() => {
    if (window.location.pathname.startsWith("/a/")) return;
    const next = `#${route.screen}`;
    if (window.location.hash !== next) {
      window.history.replaceState(null, "", next);
    }
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

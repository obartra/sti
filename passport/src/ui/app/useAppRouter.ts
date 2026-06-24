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
  // The public heads-up page (linked from the off-app text). Anonymous, no key.
  if (/^\/exposed\/?$/.test(window.location.pathname)) {
    return { screen: "exposed", group: "public", data: null };
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
  const link = parseAliasLink(window.location.pathname, window.location.hash);
  if (link) {
    // A contact invite is the same link plus a notify capability (and `ref` on a
    // return). When present, carry it so a logged-in viewer can accept (doc 13).
    const invite = parseContactInvite(
      window.location.pathname,
      window.location.hash,
    );
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
  // resolved shared link (a2-public carrying the key), leave the URL alone:
  // rewriting it would clobber the `#k=` decryption key, and it is already the
  // canonical shareable URL. Once navigated elsewhere, normalize back to the
  // hash-routed root so a refresh restores that screen instead of re-resolving
  // the now-stale `/a/{id}` link.
  useEffect(() => {
    const onAliasLink = route.screen === "a2-public" && route.data?.key != null;
    // Leave the canonical public /exposed URL alone too (it is the shared link).
    if (onAliasLink || route.screen === "exposed") return;
    const target = `/#${route.screen}`;
    if (window.location.pathname + window.location.hash !== target) {
      window.history.replaceState(null, "", target);
    }
  }, [route.screen, route.data]);

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

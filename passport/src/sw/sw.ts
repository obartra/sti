/**
 * The one service worker (doc 22 section B: one worker per scope). It does two
 * jobs in the same bundled file:
 *
 * 1. Push (slice 7): on a wake it polls this device's own notify inbox and shows
 *    the standard, contentless nudge ONLY when a real ping is present (under
 *    broadcast cover-wake every device is woken; only the real recipient's inbox
 *    decrypts). The notification names no contact and tapping it opens Care.
 * 2. Offline shell (doc 22 slice 2): install precaches the data-free app shell,
 *    activate evicts old-version shells, and fetch serves same-origin navigations
 *    network-first (falling back to the cached shell) and same-origin assets
 *    cache-first. Everything cross-origin, including api.sti.care, passes through
 *    untouched, so no response carrying user data is ever cached (doc 22 §D). The
 *    handler fails open: any error falls through to a plain network fetch.
 *
 * Bundled to dist/sw.js by vite.sw.config.ts so it runs the SAME crypto as the app.
 * The SW global is hand-typed to the small surface used here, so this file stays in
 * the app's DOM tsconfig without pulling in the conflicting WebWorker lib.
 */

import { createApiClient } from "../api/client.ts";
import { consumePartnerPing } from "./swInbox.ts";
import { readPushContext } from "./pushStore.ts";
import { PARTNER_NOTIFY_PROMPT } from "../copy/canonical.ts";
import { classify, shellCacheName, isStaleShellCache } from "./swCache.ts";
import { isShareTargetRequest, shareTargetRedirect } from "./swShare.ts";

interface ExtendableEventLike {
  waitUntil(p: Promise<unknown>): void;
}
interface NotificationEventLike extends ExtendableEventLike {
  readonly notification: { close(): void };
}
interface FetchEventLike extends ExtendableEventLike {
  readonly request: Request;
  respondWith(response: Response | Promise<Response>): void;
}
interface MessageEventLike {
  readonly data: unknown;
}
interface WindowClientLike {
  focus(): Promise<unknown>;
}
interface SwScope {
  addEventListener(
    t: "push" | "install" | "activate",
    l: (e: ExtendableEventLike) => void,
  ): void;
  addEventListener(
    t: "notificationclick",
    l: (e: NotificationEventLike) => void,
  ): void;
  addEventListener(t: "fetch", l: (e: FetchEventLike) => void): void;
  addEventListener(t: "message", l: (e: MessageEventLike) => void): void;
  skipWaiting(): Promise<void>;
  readonly location: { readonly origin: string };
  registration: {
    readonly scope: string;
    showNotification(
      title: string,
      opts?: { body?: string; tag?: string; data?: unknown },
    ): Promise<void>;
  };
  clients: {
    matchAll(opts?: {
      type?: string;
      includeUncontrolled?: boolean;
    }): Promise<WindowClientLike[]>;
    openWindow(url: string): Promise<unknown>;
  };
}

const sw = self as unknown as SwScope;

// Constant copy: contentless, never names the contact. The body is the one
// canonical partner-notify prompt, shared with the in-app nudge and Alert screen.
const NUDGE_TITLE = "sti.care";
const NUDGE_BODY = PARTNER_NOTIFY_PROMPT;
const CARE_URL = "/#care";

sw.addEventListener("push", (event) => {
  event.waitUntil(handleWake());
});

async function handleWake(): Promise<void> {
  const ctx = await readPushContext();
  if (ctx === null) return; // push not enabled on this device; ignore the wake.
  const api = createApiClient(ctx.apiBase);
  // One inbox per contact (doc 13). Poll them all; show the single contentless nudge
  // if ANY holds a real ping. Each consume clears its own inbox so a later cover wake
  // does not re-notify. Concurrent, and a failed read of one never masks another.
  const hits = await Promise.all(
    ctx.caps.map((cap) => consumePartnerPing(api, cap)),
  );
  if (hits.some((hit) => hit)) {
    await sw.registration.showNotification(NUDGE_TITLE, {
      body: NUDGE_BODY,
      tag: "partner-notify",
      data: { url: CARE_URL },
    });
  }
}

sw.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(focusOrOpen());
});

async function focusOrOpen(): Promise<void> {
  const wins = await sw.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  const open = wins[0];
  if (open !== undefined) {
    await open.focus();
    return;
  }
  await sw.clients.openWindow(CARE_URL);
}

// ---- Offline shell (doc 22 slice 2) -------------------------------------------

// Versioned by the repo stamp, so a new release installs a fresh cache and the
// activate sweep drops the old one. Only this prefix is touched; the push store
// (a separate IndexedDB) is never an entry here.
const SHELL_CACHE = shellCacheName(__APP_VERSION__);
// The precache list (data-free shell + hashed assets) emitted at build by the
// precache-manifest plugin, and the single shell document navigations fall back
// to. Both resolve against the worker's own scope, so they track the deploy base.
const PRECACHE_URL = sw.registration.scope + "precache.json";
const SHELL_URL = sw.registration.scope + "index.html";

sw.addEventListener("install", (event) => {
  event.waitUntil(precacheShell());
});

async function precacheShell(): Promise<void> {
  let urls: string[];
  try {
    const res = await fetch(new Request(PRECACHE_URL, { cache: "no-store" }));
    if (!res.ok) return;
    urls = (await res.json()) as string[];
  } catch {
    return; // first load offline: nothing to precache; runtime caching fills in.
  }
  const cache = await caches.open(SHELL_CACHE);
  await cache.addAll(urls);
}

sw.addEventListener("activate", (event) => {
  event.waitUntil(evictOldShells());
});

// Drop prior-version shells. We deliberately neither skipWaiting nor
// clients.claim(): taking over a page that loaded WITHOUT the worker can change
// the controller mid-load, which cancels in-flight requests and can serve the HTML
// shell for a sub-resource (a script then fails with a text/html MIME error).
// Instead the worker installs quietly and takes control at the NEXT navigation,
// the normal PWA lifecycle: install on visit one, offline-capable from visit two.
// A new release activates once existing tabs go (the in-app reload affordance
// nudges it), which is also what keeps old versions working (doc 22 sections E, H).
async function evictOldShells(): Promise<void> {
  const names = await caches.keys();
  await Promise.all(
    names
      .filter((name) => isStaleShellCache(name, SHELL_CACHE))
      .map((name) => caches.delete(name)),
  );
}

sw.addEventListener("fetch", (event) => {
  // A shared link (doc 22 section C) is resolved ON-DEVICE: the worker reads it from
  // the POST body and redirects, never forwarding the request, so the fragment key
  // never reaches the network. This is the one path that must NOT fail open to fetch.
  if (
    isShareTargetRequest(
      event.request.method,
      event.request.url,
      sw.registration.scope,
    )
  ) {
    event.respondWith(handleShareTarget(event.request));
    return;
  }
  const strategy = classify({
    method: event.request.method,
    url: event.request.url,
    origin: sw.location.origin,
    isNavigate: event.request.mode === "navigate",
  });
  if (strategy === "passthrough") return; // browser default fetch; never cached.
  // Fail open: any unexpected error in our handling degrades to a plain fetch.
  event.respondWith(
    serve(strategy, event.request).catch(() => fetch(event.request)),
  );
});

// Read the shared link from the form body and redirect to its in-app card route, with
// the `#k={key}` fragment rebuilt locally. The body is never fetched upstream, and any
// error (or a non-link share) falls back to the app root, never to the network, so the
// key cannot leak even on a malformed share (doc 22 section C).
async function handleShareTarget(request: Request): Promise<Response> {
  const scope = sw.registration.scope;
  try {
    const form = await request.formData();
    const str = (value: FormDataEntryValue | null): string | null =>
      typeof value === "string" ? value : null;
    const target = shareTargetRedirect(
      { url: str(form.get("url")), text: str(form.get("text")) },
      scope,
      new URL(sw.location.origin).host,
    );
    return Response.redirect(target, 303);
  } catch {
    return Response.redirect(scope, 303);
  }
}

function serve(
  strategy: "navigation" | "asset",
  request: Request,
): Promise<Response> {
  return strategy === "navigation"
    ? navigationFirst(request)
    : cacheFirst(request);
}

// Network-first: try the live document, fall back to the one precached shell when
// offline. The network response is NOT cached per-URL, so navigating to /a/{id}
// leaves no per-id entry (no visit trail); the shell comes from precache.
async function navigationFirst(request: Request): Promise<Response> {
  try {
    return await fetch(request);
  } catch (err) {
    const shell = await caches.match(SHELL_URL);
    if (shell !== undefined) return shell;
    throw err instanceof Error ? err : new Error("offline, no cached shell");
  }
}

// Cache-first for hashed, immutable, same-origin assets (no user data). A cache
// miss fetches and stores; a non-ok response is returned but not cached.
async function cacheFirst(request: Request): Promise<Response> {
  const cached = await caches.match(request);
  if (cached !== undefined) return cached;
  const res = await fetch(request);
  if (res.ok) {
    const cache = await caches.open(SHELL_CACHE);
    await cache.put(request, res.clone());
  }
  return res;
}

// ---- Update activation (doc 22 slice 3) ---------------------------------------

// The app posts SKIP_WAITING only when the user taps "Reload" on the update
// affordance, so activation is user-initiated, never a mid-use swap. On skipWaiting
// the new worker activates and the page's controllerchange reloads it.
sw.addEventListener("message", (event) => {
  if (isSkipWaiting(event.data)) void sw.skipWaiting();
});

function isSkipWaiting(data: unknown): boolean {
  return (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    data.type === "SKIP_WAITING"
  );
}

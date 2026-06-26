/**
 * Pure routing for the offline shell (doc 22, slice 2). The service worker only
 * ever touches SAME-ORIGIN GETs: the app shell and its hashed assets. Everything
 * cross-origin passes through untouched, which is exactly how api.sti.care (a
 * different origin) is never cached, with no per-host allowlist to keep in sync
 * (doc 22 section D). The classification is a pure function so it tests in Node
 * without a service worker, the way the rest of the core is tested.
 */

export type Strategy = "navigation" | "asset" | "passthrough";

export interface RouteInput {
  /** The request method; only GET is ever cached. */
  readonly method: string;
  /** The absolute request URL. */
  readonly url: string;
  /** The service worker's own origin. */
  readonly origin: string;
  /** Whether this is a top-level navigation (request.mode === "navigate"). */
  readonly isNavigate: boolean;
}

/**
 * Decide how a request is served: network-first navigation (serve the shell
 * offline), cache-first asset (hashed, immutable, no user data), or passthrough
 * (the browser's default fetch, never cached). Anything not a same-origin http(s)
 * GET is passthrough, so the cross-origin API, POST writes, and extension schemes
 * are all left alone.
 */
export function classify(input: RouteInput): Strategy {
  if (input.method !== "GET") return "passthrough";
  let parsed: URL;
  try {
    parsed = new URL(input.url);
  } catch {
    return "passthrough";
  }
  if (parsed.origin !== input.origin) return "passthrough";
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "passthrough";
  }
  return input.isNavigate ? "navigation" : "asset";
}

const CACHE_PREFIX = "shell-";

/** The versioned shell cache name; the version stamp busts it per release. */
export function shellCacheName(version: string): string {
  return `${CACHE_PREFIX}${version}`;
}

/** Whether a cache name is a shell cache from a DIFFERENT version (evict it). */
export function isStaleShellCache(name: string, current: string): boolean {
  return name.startsWith(CACHE_PREFIX) && name !== current;
}

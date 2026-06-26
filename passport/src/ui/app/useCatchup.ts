import { useEffect, useRef } from "react";

// Foreground catch-ups are throttled so rapid tab switches do not spam the read; a
// real network reconnect is rare, so it shares the same gate without feeling slow.
const THROTTLE_MS = 60_000;

/**
 * Catch up on the owner-pull whenever connectivity returns OR the app comes back to
 * the foreground, while `active` (doc 22, "Slice 5 reconsidered"). This stands in
 * for a periodic background poll: it fires on the user's OWN irregular reconnects
 * and returns-to-app, so there is no fixed cadence for the server to fingerprint,
 * and it reuses the existing foreground owner-pull (no new device-initiated read).
 * The point is a user with intermittent internet still catches a waiting
 * partner-notify the moment they are back online or back in the app, without a timer.
 */
export function useCatchup(active: boolean, refresh: () => void): void {
  const lastAt = useRef(0);
  useEffect(() => {
    if (!active) return;
    const run = (): void => {
      const now = Date.now();
      if (now - lastAt.current < THROTTLE_MS) return;
      lastAt.current = now;
      refresh();
    };
    const onVisible = (): void => {
      if (document.visibilityState === "visible") run();
    };
    window.addEventListener("online", run);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", run);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [active, refresh]);
}

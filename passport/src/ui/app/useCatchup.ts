import { useEffect, useRef } from "react";
import { reconnectJitterMs } from "../../lib/jitter.ts";

// Foreground catch-ups are throttled so rapid tab switches do not spam the read; a
// real network reconnect is rare, so it shares the same gate without feeling slow.
const THROTTLE_MS = 60_000;

/**
 * Catch up on the owner-pull whenever connectivity returns OR the app comes back to
 * the foreground, while `active` (doc 22, "Slice 5 reconsidered"). This stands in
 * for a periodic background poll: it fires on the user's OWN irregular reconnects
 * and returns-to-app, so there is no fixed cadence for the server to fingerprint,
 * and it reuses the existing foreground owner-pull (no new device-initiated read).
 *
 * The RECONNECT read is jittered (S3): it must not fire in the same instant as the
 * backup drain, or the server would see the account push and the contact-inbox reads
 * co-timed. The FOREGROUND read is prompt: the user is present and it is a single
 * read, not part of the reconnect burst.
 */
export function useCatchup(active: boolean, refresh: () => void): void {
  const lastAt = useRef(0);
  useEffect(() => {
    if (!active) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = (): void => {
      const now = Date.now();
      if (now - lastAt.current < THROTTLE_MS) return;
      lastAt.current = now;
      refresh();
    };
    const onOnline = (): void => {
      clearTimeout(timer);
      timer = setTimeout(run, reconnectJitterMs());
    };
    const onVisible = (): void => {
      if (document.visibilityState === "visible") run();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [active, refresh]);
}

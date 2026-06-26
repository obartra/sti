import { useEffect } from "react";

/**
 * Run `refresh` whenever connectivity returns, while `active` (doc 22, "Slice 5
 * reconsidered"). This is the catch-up that stands in for a periodic background
 * poll: it fires on the user's OWN irregular reconnects, so there is no fixed
 * cadence for the server to fingerprint, and it reuses the existing foreground
 * owner-pull, adding no new device-initiated read beyond what opening the app
 * already does. The point is a user with intermittent internet still gets a waiting
 * partner-notify the moment they are back online, without a timer.
 */
export function useReconnectCatchup(
  active: boolean,
  refresh: () => void,
): void {
  useEffect(() => {
    if (!active) return;
    const onOnline = (): void => refresh();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [active, refresh]);
}

import { useEffect, type RefObject } from "react";
import type { OwnerSession, SessionController } from "../../store/index.ts";
import { nowMs } from "../../core/clock.ts";

/**
 * Closes the passive-owner expiry gap for an app left OPEN (doc 16): link expiry is
 * absolute-ms and already swept on load (recover/resume), but a tab open across a
 * link's expiry instant would keep that dead link live until the next reload. This
 * re-checks while the app stays open, on an interval and whenever the tab regains
 * focus/visibility, and sweeps when something is past due.
 *
 * The trigger first checks the IN-MEMORY session (cheap, no network); only when a
 * link is actually expired does it call the controller sweep (which revokes the
 * dead links + persists). So the interval can be frequent and stays idle otherwise.
 */
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

// Whether any alias/contact link in the session is past its absolute-ms expiry.
// A null/absent expiry is until-revoked and never counts.
function hasExpiredLink(session: OwnerSession, now: number): boolean {
  const due = (e: number | null | undefined): boolean =>
    e !== null && e !== undefined && now >= e;
  return (
    session.blob.aliases.some((a) => due(a.expiresAt)) ||
    session.blob.contacts.some((c) => due(c.expiresAt))
  );
}

export function useExpirySweep(
  controller: SessionController,
  sessionRef: RefObject<OwnerSession | null>,
  setSession: (s: OwnerSession | null) => void,
  loggedIn: boolean,
): void {
  useEffect(() => {
    if (!loggedIn) return;
    // Read the latest session from the ref each tick (the timer outlives a routine
    // session edit, so it must not close over a stale snapshot).
    const sweep = (): void => {
      const current = sessionRef.current;
      if (current === null || !hasExpiredLink(current, nowMs())) return;
      void controller
        .sweepExpiredLinks(current)
        .then((updated) => {
          sessionRef.current = updated;
          setSession(updated);
        })
        .catch(() => undefined);
    };
    const onVisible = (): void => {
      if (document.visibilityState === "visible") sweep();
    };
    const id = setInterval(sweep, SWEEP_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", sweep);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", sweep);
    };
  }, [controller, sessionRef, setSession, loggedIn]);
}

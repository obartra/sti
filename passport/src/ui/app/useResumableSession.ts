import { useCallback, useEffect, useRef, useState } from "react";
import type { OwnerSession, SessionController } from "../../store/index.ts";
import { browserForgetGrantKeys } from "../../store/grantKeyStore.ts";
import { browserForgetRequesterSecret } from "../../store/requesterStore.ts";
import { browserForgetPendingKnocks } from "../../store/pendingKnockStore.ts";
import { routeFromLocation, type Nav } from "./useAppRouter.ts";

// The owner session plus its "stay signed in" lifecycle (doc 24): a silent resume
// from the persisted root on load, persisting (or not) on each login per the
// keep-signed-in choice, and a logout that forgets the stored key. Lifted out of
// App so App stays under its size ceiling.
export interface ResumableSession {
  readonly session: OwnerSession | null;
  readonly setSession: (s: OwnerSession | null) => void;
  /** Enter the app with a session, persisting it for resume when keepSignedIn. */
  readonly onSession: (s: OwnerSession) => void;
  /** Log out: forget the persisted key and return to the public landing. */
  readonly onLogOut: () => void;
  /** "Keep me signed in on this device": default ON (a pocket app mostly lives
   * on the owner's own phone); a shared device opts out at sign-up / login. */
  readonly keepSignedIn: boolean;
  readonly setKeepSignedIn: (v: boolean) => void;
}

// True when the app loaded at the bare root or the public landing, i.e. no explicit
// destination. routeFromLocation returns null for the bare root (the app maps that
// to the landing); every public content page and shared link resolves to its own
// non-landing route, which a silent resume should leave intact.
function openedAtLanding(): boolean {
  const here = routeFromLocation();
  return here === null || here.screen === "a1-landing";
}

export function useResumableSession(
  controller: SessionController,
  nav: Nav,
): ResumableSession {
  const [session, setSession] = useState<OwnerSession | null>(null);
  const [keepSignedIn, setKeepSignedIn] = useState(true);

  // Reload resume: if this device persisted its root, rebuild the session with
  // no passkey and no phrase. Once per app load (a stored key exists only if the
  // owner chose to stay signed in on a prior visit).
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current) return;
    resumed.current = true;
    let active = true;
    void controller.resumeFromStore().then((s) => {
      if (active && s !== null) {
        setSession(s);
        // Drop the returning owner at their home only when they opened the app at
        // the bare root / public landing (the PWA start_url, or a plain sti.care
        // visit): the landing is a logged-out page, so a signed-in visitor belongs
        // in the app. If they came straight to a public page they can read while
        // signed in (/privacy, /promises, /terms) or to a shared link, that
        // destination is deliberate, so honor it instead of jumping home over it.
        if (openedAtLanding()) {
          nav.jump("home");
        }
      }
    });
    return () => {
      active = false;
    };
  }, [controller, nav]);

  const onSession = useCallback(
    (s: OwnerSession) => {
      setSession(s);
      void (keepSignedIn
        ? controller.rememberDevice(s)
        : controller.forgetDevice());
      nav.jump("home");
    },
    [controller, nav, keepSignedIn],
  );

  const onLogOut = useCallback(() => {
    void controller.forgetDevice();
    // Wipe this device's viewer secrets too (the requester secret, any grant
    // keypairs, and the pending-requests list), so logging out of a shared device
    // leaves no trace of which links it knocked on or asked to see, matching what
    // account delete already does. The root key alone was cleared before; these
    // viewer secrets persisted (gap fix).
    browserForgetRequesterSecret();
    browserForgetGrantKeys();
    browserForgetPendingKnocks();
    setSession(null);
    nav.jump("a1-landing", "public");
  }, [controller, nav]);

  return {
    session,
    setSession,
    onSession,
    onLogOut,
    keepSignedIn,
    setKeepSignedIn,
  };
}

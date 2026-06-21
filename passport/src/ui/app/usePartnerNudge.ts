import { useCallback, useEffect, useState } from "react";
import type { OwnerSession, SessionController } from "../../store/index.ts";

/**
 * Owner-pull partner-notify nudge (doc 13, recipient side). A linked contact who
 * reports a positive writes one contentless ping to this device's notify inbox;
 * this hook polls for it and exposes a single boolean: should the notifications
 * feed show the standard "a recent contact suggests getting tested" row.
 *
 * The ping carries no who/when/what, so there is nothing to read past its
 * presence. Dismiss is session-scoped on purpose: the server is blind to a read,
 * so the inbox keeps returning the same ping, and without a nonce we cannot tell
 * a re-poll of the SAME ping from a genuinely new one. Hiding it for the session
 * (and on reload re-pulling) is the honest bound until per-ping read-state ships.
 * A null session (logged out) is empty.
 */
export function usePartnerNudge(
  controller: SessionController,
  session: OwnerSession | null,
): { showNudge: boolean; dismiss: () => void; refresh: () => void } {
  const [present, setPresent] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Key the auto-pull on the inbox id, not the session object, so a routine state
  // edit (report, pause) doesn't refetch; only login / logout / an account swap
  // (a different inbox, or none) does.
  const inboxKey = session?.blob.myNotify?.inboxId ?? "";

  const refresh = useCallback(() => {
    if (session === null) {
      setPresent(false);
      return;
    }
    void controller.hasPartnerNudge(session).then(setPresent).catch(noop);
    // session is read here but excluded from deps; the stable inboxKey drives
    // re-pulls and refresh always closes over the latest render.
  }, [controller, session]);

  useEffect(() => {
    // A fresh account context: drop the session-scoped dismiss so it can never
    // hide another account's nudge.
    setDismissed(false);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inboxKey]);

  const dismiss = useCallback(() => setDismissed(true), []);

  return { showNudge: present && !dismissed, dismiss, refresh };
}

function noop(): undefined {
  return undefined;
}

import { useCallback, type RefObject } from "react";
import type { OwnerSession, SessionController } from "../../store/index.ts";
import { useCatchup } from "./useCatchup.ts";

/**
 * Shared-group catch-up (doc 33, slice 7b): the group counterpart of the owner
 * inbox's reconnect/foreground pull. One refresh runs BOTH sides of the lifecycle,
 * folding the session each step:
 *   - pollGroupLifecycle: the ADMIN ingest (arrived accepts fill roster slots,
 *     leaves shrink the roster);
 *   - redeemJoinRequests: the REQUESTER pickup (an approved request becomes a join).
 * It piggybacks on useCatchup, so it fires on the user's own reconnects and returns
 * to the app, with no fixed cadence to fingerprint. `groupRefresh` is also exposed so
 * People / the group detail can trigger it on mount, so a just-arrived join shows.
 *
 * Gated to a logged-in, non-demo session: demo's poll stubs are inert no-ops, so this
 * is safe either way, but gating keeps the demo quiet.
 */
export function useGroupCatchup(
  controller: SessionController,
  sessionRef: RefObject<OwnerSession | null>,
  setSession: (s: OwnerSession | null) => void,
  active: boolean,
): { groupRefresh: () => Promise<void> } {
  const groupRefresh = useCallback(async () => {
    const current = sessionRef.current;
    if (current === null) return;
    try {
      const afterPoll = await controller.pollGroupLifecycle(current);
      sessionRef.current = afterPoll;
      const afterRedeem = await controller.redeemJoinRequests(afterPoll);
      sessionRef.current = afterRedeem;
      setSession(afterRedeem);
    } catch {
      // Best-effort and fail-closed: a failed poll leaves the session as-is.
    }
  }, [controller, sessionRef, setSession]);

  useCatchup(active, () => void groupRefresh());

  return { groupRefresh };
}

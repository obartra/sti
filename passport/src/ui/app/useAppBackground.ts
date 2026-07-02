import { type RefObject } from "react";
import type { OwnerSession, SessionController } from "../../store/index.ts";
import { useExpirySweep } from "./useExpirySweep.ts";
import { useGroupCatchup } from "./useGroupCatchup.ts";

/**
 * The app's background upkeep for a logged-in owner, bundled so App stays within its
 * statement ceiling: link-expiry sweeping (doc 16) and shared-group catch-up (doc 33).
 * Both are no-ops while logged out; the group catch-up is also gated off in demo mode
 * (its poll stubs are inert, but gating keeps the demo quiet). Returns the group
 * refresh so People / the group detail can trigger it on mount.
 */
export function useAppBackground(
  controller: SessionController,
  sessionRef: RefObject<OwnerSession | null>,
  setSession: (s: OwnerSession | null) => void,
  gate: { session: OwnerSession | null; demoMode: boolean },
): () => Promise<void> {
  const active = gate.session !== null;
  useExpirySweep(controller, sessionRef, setSession, active);
  return useGroupCatchup(
    controller,
    sessionRef,
    setSession,
    active && !gate.demoMode,
  ).groupRefresh;
}

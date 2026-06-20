import { useCallback, useEffect, useState } from "react";
import type { OwnerSession, SessionController } from "../../store/index.ts";

/**
 * Owner-pull knock review: the count of current knocks across the owner's
 * aliases, for the quiet inbox indicator (doc 02 — owner-pull, never pushed). It
 * pulls when the account changes (login / an alias added or revoked) and exposes
 * `refresh` so the inbox can re-pull on open. Contentless: a number, never who.
 * A null session (logged out) is zero.
 */
export function useKnockReview(
  controller: SessionController,
  session: OwnerSession | null,
): { knockCount: number; refresh: () => void } {
  const [knockCount, setKnockCount] = useState(0);

  // Key the auto-pull on the set of alias ids, not the session object, so a
  // routine state edit (report, pause) doesn't trigger a refetch; only login or
  // an alias change does.
  const aliasKey = session
    ? session.blob.aliases.map((a) => a.id).join(",")
    : "";

  const refresh = useCallback(() => {
    if (session === null) {
      setKnockCount(0);
      return;
    }
    void controller
      .reviewKnocks(session)
      .then(setKnockCount)
      .catch(() => undefined);
    // session is intentionally read here but excluded from deps; the stable
    // aliasKey drives re-pulls, and refresh always closes over the latest render.
  }, [controller, session]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aliasKey]);

  return { knockCount, refresh };
}

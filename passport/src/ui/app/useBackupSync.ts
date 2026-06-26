import { useCallback, useEffect, useState } from "react";
import type {
  OwnerSession,
  OfflineAccountSync,
  SyncStatus,
} from "../../store/index.ts";
import type { OwnerState } from "../../core/badge.ts";

/**
 * Surfaces whether this device holds owner edits the server has not received yet,
 * and drains them when connectivity returns (doc 22 slice 4). The drain runs in the
 * foreground with the master in hand (the worker has no key, doc 22 S1): it
 * re-applies the current state (a no-op change) through `setOwnerState`, which
 * re-pushes the blob and republishes the badge. Returns `pending` for the
 * not-backed-up affordance.
 */
export function useBackupSync(
  syncStatus: SyncStatus,
  offlineSync: OfflineAccountSync,
  session: OwnerSession | null,
  setOwnerState: (update: (prev: OwnerState) => OwnerState) => void,
): boolean {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const drain = useCallback(() => setOwnerState((s) => s), [setOwnerState]);

  // Resolve this session's opaque account id once (async key derivation).
  useEffect(() => {
    if (session === null) {
      setAccountId(null);
      setPending(false);
      return;
    }
    let alive = true;
    void offlineSync.accountId(session.master).then((id) => {
      if (alive) setAccountId(id);
    });
    return () => {
      alive = false;
    };
  }, [session, offlineSync]);

  // Track the pending flag for this account; the marker self-clears on drain.
  useEffect(() => {
    if (accountId === null) return;
    const refresh = (): void =>
      setPending(syncStatus.snapshot(accountId).pending);
    refresh();
    return syncStatus.subscribe(refresh);
  }, [accountId, syncStatus]);

  // Drain on reconnect, and immediately if we are already online with work owed.
  useEffect(() => {
    if (accountId === null) return;
    const maybeDrain = (): void => {
      if (syncStatus.snapshot(accountId).pending) drain();
    };
    window.addEventListener("online", maybeDrain);
    if (navigator.onLine) maybeDrain();
    return () => window.removeEventListener("online", maybeDrain);
  }, [accountId, syncStatus, drain]);

  return pending;
}

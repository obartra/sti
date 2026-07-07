import { useCallback, useEffect, useState } from "react";
import type {
  GrantMode,
  OwnerSession,
  PendingApproval,
  SessionController,
} from "../../store/index.ts";

/**
 * Owner-pull knock review for the quiet inbox (doc 02 — owner-pull, never pushed).
 * One sweep returns two contentless things: the total knock COUNT (drives the bell
 * dot and the "someone asked" row, never names who) and the grantable PENDING
 * approvals (knocks that carried a key, so the owner can grant them in-app). It
 * pulls when the account changes (login / an alias added or revoked) and exposes
 * `refresh` so the inbox re-pulls on open. A null session (logged out) is empty.
 */
export function useKnockReview(
  controller: SessionController,
  session: OwnerSession | null,
): {
  knockCount: number;
  canApprove: boolean;
  showInfo: boolean;
  approve: (mode: GrantMode) => void;
  approving: boolean;
  refresh: () => void;
} {
  const [knockCount, setKnockCount] = useState(0);
  const [pending, setPending] = useState<PendingApproval[]>([]);
  const [approving, setApproving] = useState(false);
  // Requesters already granted this session. The server is blind to a grant, so a
  // re-review still returns the same knock; we hide the ones we've approved so the
  // owner sees the row clear (their only confirmation it worked) instead of an
  // Approve button that never goes away. Re-approving is harmless, just confusing.
  const [granted, setGranted] = useState<ReadonlySet<string>>(new Set());

  // Key the auto-pull on the set of alias ids, not the session object, so a
  // routine state edit (report, pause) doesn't trigger a refetch; only login or
  // an alias change does.
  const aliasKey = session
    ? session.blob.aliases.map((a) => a.id).join(",")
    : "";

  const refresh = useCallback(() => {
    if (session === null) {
      setKnockCount(0);
      setPending([]);
      return;
    }
    void controller
      .reviewKnocks(session)
      .then((r) => {
        setKnockCount(r.count);
        setPending(r.pending);
      })
      .catch(noop);
    // session is intentionally read here but excluded from deps; the stable
    // aliasKey drives re-pulls, and refresh always closes over the latest render.
  }, [controller, session]);

  useEffect(() => {
    // A login / logout / alias change is a fresh context: drop the granted-this-
    // session memory so it can never hide another account's (or a later) knock.
    setGranted(new Set());
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aliasKey]);

  // The knocks still worth showing an Approve for: not yet granted this session.
  const ungranted = pending.filter((p) => !granted.has(approvalKey(p)));

  const approve = useCallback(
    (mode: GrantMode) => {
      if (session === null || approving) return;
      const toGrant = pending.filter((p) => !granted.has(approvalKey(p)));
      if (toGrant.length === 0) return;
      const grantedKeys = toGrant.map(approvalKey);
      setApproving(true);
      void controller
        .approveKnocks(session, toGrant, mode)
        // Only on full success: a rejection marks none, so the owner retries all.
        .then(() => setGranted((prev) => new Set([...prev, ...grantedKeys])))
        .catch(noop)
        .finally(() => {
          setApproving(false);
          refresh();
        });
    },
    [controller, session, pending, granted, approving, refresh],
  );

  return {
    knockCount,
    canApprove: ungranted.length > 0,
    // The contentless "someone asked" row is for knocks we CAN'T grant in-app
    // (they carried no key): total knocks beyond the grantable ones. So once every
    // grantable knock is approved, the entry disappears instead of lingering.
    showInfo: knockCount > pending.length,
    approve,
    approving,
    refresh,
  };
}

// A stable per-(alias, requester) key, so a re-reviewed knock is recognized as
// one already granted this session.
function approvalKey(a: PendingApproval): string {
  return `${a.alias.id}:${a.pending.requesterHash}`;
}

function noop(): undefined {
  return undefined;
}

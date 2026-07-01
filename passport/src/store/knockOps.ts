/**
 * Owner-pull knock review + approval, split out of session.ts so the controller
 * stays within its size ceiling (like shareOps / findableOps / recoveryOps). Pure
 * over the ApiClient; the controller just delegates.
 */

import type { ApiClient } from "../api/client.ts";
import { grantAccess } from "./grant.ts";
import type { AliasRecord } from "./accountBlob.ts";
import type { OwnerSession, OwnerKnocks, PendingApproval } from "./session.ts";

// Every alias a knock can land on: the public/casual aliases plus every per-contact
// link. Used by the owner-pull knock review and the approve flow.
function ownerLinks(session: OwnerSession): AliasRecord[] {
  return [
    ...session.blob.aliases,
    ...session.blob.contacts.map((c) => c.alias),
  ];
}

// One knock-review sweep across every owner link: sum the contentless count and
// collect the grantable knocks (those that carried a key), each tagged with its
// alias. A single pass per alias, so count and pending can't read a torn pair.
// Best-effort per alias: an unreachable one contributes nothing.
export async function gatherKnocks(
  api: ApiClient,
  session: OwnerSession,
): Promise<OwnerKnocks> {
  const perAlias = await Promise.all(
    ownerLinks(session).map(async (alias) => {
      const review = await api
        .knockReview(alias.id, alias.writeToken)
        .catch(() => ({ count: 0, pending: [] }));
      return {
        count: review.count,
        pending: review.pending
          .filter((p) => p.pubKey)
          .map((pending) => ({ alias, pending })),
      };
    }),
  );
  return {
    count: perAlias.reduce((sum, r) => sum + r.count, 0),
    pending: perAlias.flatMap((r) => r.pending),
  };
}

// Seal each approval's alias key to its waiting requester (the in-app grant).
// Returns how many were granted. All-or-nothing for the caller: a single failure
// rejects the whole call (so the UI marks none as granted and the owner retries
// all); grantAccess is idempotent, so re-sealing the ones that already succeeded is
// harmless.
export async function grantPending(
  api: ApiClient,
  approvals: PendingApproval[],
): Promise<number> {
  await Promise.all(approvals.map((x) => grantAccess(api, x.alias, x.pending)));
  return approvals.length;
}

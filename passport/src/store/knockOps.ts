/**
 * Owner-pull knock review + approval, split out of session.ts so the controller
 * stays within its size ceiling (like shareOps / findableOps / recoveryOps). Pure
 * over the ApiClient; the controller just delegates.
 */

import type { ApiClient } from "../api/client.ts";
import { grantAccess } from "./grant.ts";
import { deriveAliasCard } from "./ownerCard.ts";
import { serializePublicCard } from "./publicCard.ts";
import { todayEpochDay } from "../core/clock.ts";
import type { AliasRecord } from "./accountBlob.ts";
import type { OwnerSession, OwnerKnocks, PendingApproval } from "./session.ts";

/**
 * How an approve delivers access (doc 13). "standing" seals the alias read key, so the
 * viewer keeps re-checking the owner's live status until it is revoked. "once" seals a
 * frozen snapshot of the owner's current card, so the viewer sees the status this once
 * and gets no live/re-checkable access (they can still screenshot what they saw;
 * "one-time" means no live access, not "unsee").
 */
export type GrantMode = "once" | "standing";

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

// Seal a grant to each approval's waiting requester (the in-app grant). "standing"
// seals the alias read key (live access); "once" seals a frozen snapshot of that
// alias's current card, built from the owner's live state, so the viewer sees the
// status once with no live access. Returns how many were granted. All-or-nothing for
// the caller: a single failure rejects the whole call (so the UI marks none as granted
// and the owner retries all); grantAccess is idempotent, so re-sealing the ones that
// already succeeded is harmless.
export async function grantPending(
  api: ApiClient,
  session: OwnerSession,
  approvals: PendingApproval[],
  mode: GrantMode,
): Promise<number> {
  const nowDay = todayEpochDay();
  await Promise.all(
    approvals.map((x) => {
      if (mode === "standing") {
        return grantAccess(api, x.alias, x.pending, { kind: "key" });
      }
      const card = serializePublicCard(
        deriveAliasCard(session.blob.state, x.alias, nowDay),
      );
      return grantAccess(api, x.alias, x.pending, { kind: "card", card });
    }),
  );
  return approvals.length;
}

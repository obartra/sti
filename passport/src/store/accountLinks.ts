/**
 * Link upkeep for the account manager, split out of account.ts so it stays within
 * its length ceiling: expiry sweep (doc 16), status republish helpers, and the
 * republish-on-open method (doc 02). Pure over the passed blob + api; no sync of its
 * own except through the injected AccountSync in the method factory.
 */

import type { ApiClient } from "../api/client.ts";
import type { RootKey } from "../crypto/index.ts";
import type { OwnerState } from "../core/badge.ts";
import type { AccountBlob } from "./accountBlob.ts";
import type { AccountSync } from "./accountSync.ts";
import type { AccountManager } from "./account.ts";
import { republishOwnerCard } from "./ownerCard.ts";
import { revokeAlias } from "./publish.ts";
import { todayEpochDay, nowMs } from "../core/clock.ts";

// A link with an expiry is expired once now reaches its instant; a null/absent
// expiry (until-revoked) never is. Times are absolute epoch ms (doc 16). Shared by
// the sweep and the republish-skip so an expired link is treated the same.
function isExpired(expiresAt: number | null | undefined, now: number): boolean {
  return expiresAt !== null && expiresAt !== undefined && now >= expiresAt;
}

// Sweep expired links: overwrite each expired alias / contact link to garbage
// (revoke) so it stops resolving, then return the blob carrying only the live
// links plus the new state. Revoke runs BEFORE the records are dropped so a link
// always still has a capability to kill it; "expired" therefore means "no future
// reads", enforced whenever the owner next acts.
export async function sweepExpired(
  api: ApiClient,
  blob: AccountBlob,
  state: OwnerState,
  now: number,
): Promise<AccountBlob> {
  await Promise.all([
    ...blob.contacts
      .filter((c) => isExpired(c.expiresAt, now))
      .map((c) => revokeAlias(api, c.alias)),
    ...blob.aliases
      .filter((a) => isExpired(a.expiresAt, now))
      .map((a) => revokeAlias(api, a)),
  ]);
  return {
    ...blob,
    state,
    contacts: blob.contacts.filter((c) => !isExpired(c.expiresAt, now)),
    aliases: blob.aliases.filter((a) => !isExpired(a.expiresAt, now)),
  };
}

/**
 * Republish the owner's current card (the current badge, plus each alias's own
 * per-alias display identity, doc 15) to every still-live shared link. Shared by
 * setOwnerState (a badge change) and refreshLiveLinks (republish-on-open); it skips
 * expired links itself, so a re-seal can never resurrect a dead link. The
 * decorrelation gap documented on republishOwnerCard applies. Per-alias identity does
 * not propagate from the account: each alias keeps its own face (doc 15 non-goal).
 */
export async function republishLiveLinks(
  api: ApiClient,
  blob: AccountBlob,
  nowDay: number,
): Promise<void> {
  // Expiry is absolute ms; the badge derivation still uses the day clock.
  const now = nowMs();
  const liveAliases = blob.aliases.filter((a) => !isExpired(a.expiresAt, now));
  const liveContacts = blob.contacts.filter(
    (c) => !isExpired(c.expiresAt, now),
  );
  const liveLinks = [...liveAliases, ...liveContacts.map((c) => c.alias)];
  await republishOwnerCard(api, liveLinks, { state: blob.state, nowDay });
}

// The load/open link-upkeep methods, spread into the account manager: expiry sweep
// (doc 16) and card republish-on-open (doc 02).
export function linkUpkeepMethods(
  api: ApiClient,
  sync: AccountSync,
): Pick<AccountManager, "sweepExpiredLinks" | "refreshLiveLinks"> {
  return {
    async sweepExpiredLinks(root: RootKey) {
      const blob = await sync.load(root);
      if (blob === null) {
        throw new Error("sweepExpiredLinks: no account exists for this key");
      }
      const now = nowMs();
      const anyExpired =
        blob.contacts.some((c) => isExpired(c.expiresAt, now)) ||
        blob.aliases.some((a) => isExpired(a.expiresAt, now));
      // Nothing to do: skip the revoke + write so a clean load is a pure read.
      if (!anyExpired) return blob;
      // Same revoke + drop sweep as setOwnerState, state unchanged (a load does not
      // move the badge), no republish (survivors' cards are unchanged).
      const next = await sweepExpired(api, blob, blob.state, now);
      await sync.save(root, next);
      return next;
    },
    // Re-seal the current state at today's day so a snapshot that aged out of (or
    // into) blue is brought current for viewers, without the owner's next edit.
    // Read-only on the blob; republishLiveLinks is a no-op when nothing is live.
    async refreshLiveLinks(root: RootKey) {
      const blob = await sync.load(root);
      if (blob !== null) await republishLiveLinks(api, blob, todayEpochDay());
    },
  };
}

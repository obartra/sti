/**
 * Partner-notify session helpers (doc 13 + doc 33 slice 6): the send side (notify
 * everyone a reported positive implies was exposed) and the recipient side (poll this
 * device's own inboxes for a ping). Split out of session.ts to keep that file within
 * its length ceiling. Everything is contentless and blind.
 */

import type { ApiClient } from "../api/client.ts";
import type { AccountManager } from "./account.ts";
import type { OwnerSession } from "./session.ts";
import {
  encodePartnerPing,
  parsePartnerPing,
  sendPing,
  type NotifyLockResult,
} from "./partnerNotify.ts";
import { pollInbox, type NotifyCapability } from "./notifyInbox.ts";
import { groupNotifyTargets } from "./groupMembershipOps.ts";
import { base64urlToBytes, deriveGroupNotify } from "../crypto/index.ts";
import type { GroupKey } from "./groupCrypto.ts";

// Gather every inbox a reported positive should reach: the pairwise contacts the
// owner holds a notify capability for (doc 13), plus, for every group the owner is in
// (admin or member), the group-notify channel of each co-member the group implies was
// exposed (doc 33). Group opens are threaded through the session so a member's Kg
// cache updates carry forward, and each group is fail-closed on its own (a group that
// will not open contributes no targets and never throws), so one bad group never
// blocks the rest.
async function positiveTargets(
  api: ApiClient,
  accounts: AccountManager,
  session: OwnerSession,
): Promise<NotifyCapability[]> {
  const pairwise = session.blob.contacts
    .map((c) => c.theirNotify)
    .filter((cap): cap is NotifyCapability => cap !== undefined);
  const group: NotifyCapability[] = [];
  let working = session;
  for (const g of session.blob.groups ?? []) {
    try {
      const res = await groupNotifyTargets(api, accounts, working, g.groupId);
      working = res.session;
      group.push(...res.targets);
    } catch {
      // Fail-closed per group: an unopenable group contributes no targets.
    }
  }
  return [...pairwise, ...group];
}

// Silently notify everyone a reported positive implies was exposed: the linked
// contacts (doc 13) AND every co-member of every group the owner is in (doc 33), as
// ordinary individual, contentless pings, never attributed to the group or the
// reporter. The pairwise and group targets are MERGED and deduped by inboxId into ONE
// batch, so the reporter's write burst is a single set of opaque inbox writes,
// indistinguishable from a pairwise-only batch of the same size: the server cannot
// tell the N pings are one group event. A co-member who is also a pairwise contact is
// pinged once. The reporter chooses nothing and this is never surfaced at the report
// moment; it just happens. The result is per-inbox and the caller ignores it.
export async function notifyPositive(
  api: ApiClient,
  accounts: AccountManager,
  session: OwnerSession,
): Promise<NotifyLockResult> {
  const caps = await positiveTargets(api, accounts, session);
  const ping = encodePartnerPing();
  const sent: string[] = [];
  const failed: string[] = [];
  const seen = new Set<string>();
  for (const cap of caps) {
    if (seen.has(cap.inboxId)) continue;
    seen.add(cap.inboxId);
    if (await sendPing(api, cap, ping)) sent.push(cap.inboxId);
    else failed.push(cap.inboxId);
  }
  return { sent, skipped: [], failed };
}

// The recipient side: poll the owner's own inboxes for a partner-notify ping. Each
// pairwise contact nudges through its own dedicated inbox (doc 13), and each group the
// owner has synced (`kg` cached) nudges through the owner's own derived group-notify
// inbox for that group (doc 33). The owner polls them all and the first real ping
// wins. There is deliberately NO per-group signal and NO group attribution: any hit
// ORs into the SAME single aggregate boolean, so the surfaced UX stays the existing
// "a recent contact suggests getting tested." False (not an error) when there are no
// inboxes yet, every inbox is empty/decoy, or nothing decodes to a well-formed ping.
// Fail-closed: a group whose `kg` is not cached is skipped, and one failed read never
// masks another inbox's ping. Polls run concurrently.
export async function pollPartnerNudge(
  api: ApiClient,
  session: OwnerSession,
): Promise<boolean> {
  const pairwise = session.blob.contacts
    .map((c) => c.myInbox)
    .filter((cap): cap is NotifyCapability => cap !== undefined);
  const group = await Promise.all(
    (session.blob.groups ?? [])
      .flatMap((g) =>
        g.kg !== undefined ? [{ kg: g.kg, cardId: g.myCardId }] : [],
      )
      .map((g) =>
        deriveGroupNotify(base64urlToBytes(g.kg) as GroupKey, g.cardId),
      ),
  );
  const results = await Promise.all(
    [...pairwise, ...group].map(async (cap) => {
      const ping = await pollInbox(api, cap);
      return ping !== null && parsePartnerPing(ping) !== null;
    }),
  );
  return results.some((hit) => hit);
}

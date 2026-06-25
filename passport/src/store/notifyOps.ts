/**
 * Partner-notify session helpers (doc 13): the send side (notify every linked
 * contact that a positive was reported) and the recipient side (poll this device's
 * own inbox for a ping). Split out of session.ts to keep that file within its
 * length ceiling. Everything is contentless and blind.
 */

import type { ApiClient } from "../api/client.ts";
import type { OwnerSession } from "./session.ts";
import {
  lockNotifyDraft,
  parsePartnerPing,
  type NotifyLockResult,
} from "./partnerNotify.ts";
import { pollInbox } from "./notifyInbox.ts";

// Silently notify every linked contact (those with a notify capability) that a
// positive was reported: a contentless ping to each inbox + a wake. No window and
// no reporter choice, everyone you've linked with is told, automatically.
export function notifyLinkedContacts(
  api: ApiClient,
  session: OwnerSession,
): Promise<NotifyLockResult> {
  const ids = session.blob.contacts
    .filter((c) => c.theirNotify !== undefined)
    .map((c) => c.id);
  return lockNotifyDraft(api, session.blob, ids);
}

// The recipient side: poll the owner's per-contact inboxes for a partner-notify
// ping. Each contact nudges through its own dedicated inbox (doc 13), so the owner
// polls them all; the first real ping wins. False (not an error) when there are no
// inboxes yet, every inbox is empty/decoy, or no bytes decode to a well-formed ping.
// The ping is contentless, so this only ever answers "is there a nudge", never who
// sent it. Polls run concurrently; one failed read never masks another inbox's ping.
export async function pollPartnerNudge(
  api: ApiClient,
  session: OwnerSession,
): Promise<boolean> {
  const caps = session.blob.contacts
    .map((c) => c.myInbox)
    .filter((cap): cap is NonNullable<typeof cap> => cap !== undefined);
  const results = await Promise.all(
    caps.map(async (cap) => {
      const ping = await pollInbox(api, cap);
      return ping !== null && parsePartnerPing(ping) !== null;
    }),
  );
  return results.some((hit) => hit);
}

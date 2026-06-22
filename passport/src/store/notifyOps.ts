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

// The recipient side: poll this device's own inbox for a partner-notify ping.
// False (not an error) when no inbox is minted yet, the inbox is empty/decoy, or
// the bytes do not decode to a well-formed ping. The ping is contentless, so this
// only ever answers "is there a nudge", never who sent it.
export async function pollPartnerNudge(
  api: ApiClient,
  session: OwnerSession,
): Promise<boolean> {
  const cap = session.blob.myNotify;
  if (cap === undefined) return false;
  const ping = await pollInbox(api, cap);
  return ping !== null && parsePartnerPing(ping) !== null;
}

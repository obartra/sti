/**
 * The service worker's wake handler core (slice 7), kept as a plain testable module
 * so the security-critical part runs the SAME crypto as the app, never a reimpl.
 *
 * Under broadcast cover-wake (doc 13 decision 2) a wake reaches EVERY registered
 * device; only the real recipient's notify-inbox decrypts a ping, everyone else
 * polls a decoy. So on a wake the worker polls its own inbox and shows a
 * notification only when a real partner-notify ping is present. It then clears the
 * inbox (overwrites with a random, existence-uniform payload) so the same ping is
 * not re-notified on the next cover wake. Everything is fail-closed: an unreachable
 * or undecodable inbox reads as "no ping", never an error and never a false alarm.
 */

import type { ApiClient } from "../api/client.ts";
import {
  pollInbox,
  writePing,
  type NotifyCapability,
} from "../store/notifyInbox.ts";
import { parsePartnerPing } from "../store/partnerNotify.ts";
import type { Bytes } from "../crypto/index.ts";

/**
 * Poll this device's notify inbox for a real partner-notify ping. Returns true
 * only for a genuine ping (not a decoy/cover), and clears the inbox so a later
 * cover wake does not re-notify the same ping. Best-effort clear: a failed clear at
 * worst shows the nudge once more, it never blocks notifying. Only the inbox ops on
 * `api` are used.
 */
export async function consumePartnerPing(
  api: ApiClient,
  cap: NotifyCapability,
): Promise<boolean> {
  const ping = await pollInbox(api, cap);
  if (ping === null || parsePartnerPing(ping) === null) return false;
  try {
    await writePing(api, cap, clearedMarker());
  } catch {
    // Dedup is best-effort; never let a failed clear suppress the notification.
  }
  return true;
}

// A random, non-ping payload: a re-poll decrypts it to bytes that parsePartnerPing
// rejects, and being random it stays existence-uniform like any other decoy.
function clearedMarker(): Bytes {
  const marker = new Uint8Array(new ArrayBuffer(16));
  crypto.getRandomValues(marker);
  return marker;
}

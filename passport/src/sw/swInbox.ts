/**
 * The service worker's wake handler core (slice 7), kept as a plain testable module
 * so the security-critical part runs the SAME crypto as the app, never a reimpl.
 *
 * Under broadcast cover-wake (doc 13 decision 2) a wake reaches EVERY registered
 * device; only the real recipient's notify-inbox decrypts a ping, everyone else
 * polls a decoy. So on a wake the worker polls its own inbox and shows a
 * notification only when a real partner-notify ping is present.
 *
 * Dedup is DEVICE-LOCAL, by (inboxId, nonce), NOT a server write. It used to clear
 * the consumed inbox by overwriting it with a random marker (a PUT /inbox), so that a
 * later cover wake would not re-notify. But only the real recipient could decrypt a
 * ping, so only the recipient emitted that clear-write: the server saw one extra
 * write shortly after each broadcast and could re-identify the recipient set by write
 * timing, voiding the broadcast's recipient-hiding. Now the recipient records the
 * ping's per-report nonce locally (consumedPings) and writes NOTHING back. Every
 * device performs the same read and nothing else, so recipients and non-recipients
 * are byte- and behavior-identical on the poll path. Everything stays fail-closed: an
 * unreachable or undecodable inbox reads as "no ping", and a storage error in the
 * local dedup reads as "not yet consumed" (re-notify at worst, never a write).
 */

import type { ApiClient } from "../api/client.ts";
import { pollInbox, type NotifyCapability } from "../store/notifyInbox.ts";
import { parsePartnerPing } from "../store/partnerNotify.ts";
import { markPingConsumed } from "./consumedPings.ts";

/**
 * Poll this device's notify inbox for a real partner-notify ping. Returns true only
 * for a genuine, not-yet-consumed ping (not a decoy/cover, and not one this device
 * already notified for under the same nonce). Emits NO write: it only reads the inbox
 * (a GET), then records the consumed nonce in device-local storage. A re-poll of the
 * same (inboxId, nonce) returns false without notifying and without writing; a new
 * nonce at the same inbox notifies again. Only the inbox read op on `api` is used.
 */
export async function consumePartnerPing(
  api: ApiClient,
  cap: NotifyCapability,
): Promise<boolean> {
  const bytes = await pollInbox(api, cap);
  if (bytes === null) return false;
  const ping = parsePartnerPing(bytes);
  if (ping === null) return false;
  // Local dedup only; no server write on the recipient path. markPingConsumed
  // returns true only the first time this (inboxId, nonce) is seen.
  return markPingConsumed(cap.inboxId, ping.nonce);
}

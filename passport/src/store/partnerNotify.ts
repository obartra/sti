/**
 * The partner-notify draft/lock batch (doc 13 slice 5). After the owner reports a
 * positive, the client composes a draft batch of contacts to notify (default: the
 * ones linked within the lookback window that the owner has exchanged notify
 * capabilities with). The owner edits the set freely; locking writes one encrypted
 * ping to each selected contact's inbox and asks the server to queue a wake.
 *
 * Everything is contentless and blind: the ping is a fixed-size sealed marker that
 * carries no who/when/what (the recipient's app shows a standard "a recent contact
 * suggests getting tested" message and the static where-to-test + PEP info), and
 * the wake is `hash(routingToken)`, so the server learns neither the recipient nor
 * that a notification happened beyond an opaque inbox write.
 *
 * This is the channel logic, tested against the live store. The wake only lands
 * once push routing + the gate ship (slice 7); until then the recipient finds the
 * ping on its next uniform inbox poll regardless of the wake.
 */

import type { ApiClient } from "../api/client.ts";
import {
  sha256Base64url,
  utf8ToBytes,
  bytesToUtf8,
  type Bytes,
} from "../crypto/index.ts";
import type { AccountBlob, ContactRecord } from "./accountBlob.ts";
import { writePing, type NotifyCapability } from "./notifyInbox.ts";

// A starting default for "linked within the relevant window": the owner edits the
// draft freely, so this only seeds the initial selection, never constrains it. Set
// to ~6 months (not the 90-day badge window) so a returning owner reporting a
// positive still reaches partners from a little further back by default, and a
// mistyped test date a week or two off does not silently drop relevant contacts
// from the suggestion. It is a seed, not a retention rule: contacts are never
// auto-deleted, only the default selection is bounded.
export const NOTIFY_DEFAULT_LOOKBACK_DAYS = 183;

const PING_VERSION = 1;
const PING_KIND = "partner-notify";

/** A decoded partner-notify ping. Contentless by design: only its kind matters. */
export interface PartnerPing {
  readonly kind: typeof PING_KIND;
}

/** Encode the fixed, contentless partner-notify ping (no who/when/what). */
export function encodePartnerPing(): Bytes {
  return utf8ToBytes(JSON.stringify({ v: PING_VERSION, kind: PING_KIND }));
}

/** Decode a decrypted ping; null if it is not a well-formed partner-notify ping. */
export function parsePartnerPing(bytes: Bytes): PartnerPing | null {
  try {
    const o: unknown = JSON.parse(bytesToUtf8(bytes));
    if (typeof o !== "object" || o === null) return null;
    const r = o as Record<string, unknown>;
    if (r.v !== PING_VERSION || r.kind !== PING_KIND) return null;
    return { kind: PING_KIND };
  } catch {
    return null;
  }
}

/** One contact the owner may notify, with the private label for the review UI. */
export interface NotifyDraftEntry {
  readonly contactId: string;
  /** The owner's private nickname; for the UI only, never sent. */
  readonly label: string;
}

/** The default notify batch: editable by the owner before locking. */
export interface NotifyDraft {
  readonly createdDay: number;
  readonly entries: NotifyDraftEntry[];
}

/** A contact is notifiable once the owner holds its notify capability. */
function isNotifiable(c: ContactRecord): boolean {
  return c.theirNotify !== undefined;
}

/**
 * Seed a draft batch: the notifiable contacts linked within the lookback window,
 * newest first. The owner adds, removes, or clears entries before locking, so this
 * is only the starting selection, never the final set.
 */
export function composeNotifyDraft(
  blob: AccountBlob,
  nowDay: number,
  lookbackDays: number = NOTIFY_DEFAULT_LOOKBACK_DAYS,
): NotifyDraft {
  const since = nowDay - lookbackDays;
  const entries = blob.contacts
    .filter((c) => isNotifiable(c) && c.createdDay >= since)
    .sort((a, b) => b.createdDay - a.createdDay)
    .map((c) => ({ contactId: c.id, label: c.label }));
  return { createdDay: nowDay, entries };
}

/** How a locked batch resolved, per contact, so the UI can report it honestly. */
export interface NotifyLockResult {
  /** Pings written (and a wake attempted). */
  readonly sent: string[];
  /** Contacts not found, or without a notify capability yet. */
  readonly skipped: string[];
  /** Contacts whose ping write failed (left for a retry). */
  readonly failed: string[];
}

// The wake is keyed by the hash of the routing token; the server only ever sees
// this hash, never the token, so it cannot link a wake to an inbox or a contact.
function routingHash(routingToken: string): Promise<string> {
  return sha256Base64url(utf8ToBytes(routingToken));
}

// Write one ping to a contact's inbox, then ask for a wake. Returns false only if
// the ping write fails (the contact is not notified); the wake is fire-and-forget,
// since the recipient finds a delivered ping on its next uniform poll regardless.
// Exported so the merged positive fan-out (notifyOps) reuses the EXACT same write +
// wake for group-derived inboxes, keeping a group ping byte- and behavior-identical
// to a pairwise one.
export async function sendPing(
  api: ApiClient,
  cap: NotifyCapability,
  ping: Bytes,
): Promise<boolean> {
  try {
    await writePing(api, cap, ping);
  } catch {
    return false;
  }
  try {
    await api.notify(await routingHash(cap.routingToken));
  } catch {
    // Best-effort wake; the ping is the source of truth.
  }
  return true;
}

/**
 * Lock the batch: for each selected contact, write one encrypted partner-notify
 * ping to its inbox and ask the server to queue a wake. Best-effort per contact, so
 * one bad inbox never blocks the rest. Returns the per-contact outcome.
 */
export async function lockNotifyDraft(
  api: ApiClient,
  blob: AccountBlob,
  contactIds: readonly string[],
): Promise<NotifyLockResult> {
  const byId = new Map(blob.contacts.map((c) => [c.id, c]));
  const ping = encodePartnerPing();
  const sent: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];

  // Dedupe so a contact listed twice is notified (and counted) once.
  for (const id of new Set(contactIds)) {
    const cap = byId.get(id)?.theirNotify;
    if (cap === undefined) skipped.push(id);
    else if (await sendPing(api, cap, ping)) sent.push(id);
    else failed.push(id);
  }
  return { sent, skipped, failed };
}

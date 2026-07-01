import type { StorageLike } from "../../auth/deviceStore.ts";
import { nowMs, DAY_MS } from "../../core/clock.ts";

// Continuity nudges (doc 32, "Keeping the recovery factor memorized"). Two gentle,
// dismissible reminders that help the owner keep their way back into the account:
//
// - A rare recovery-phrase rehearsal ("can you still find it?"). Because the phrase
//   is always the backstop, this is a rehearsal, never a lockout.
// - A once-a-year suggestion to refresh a password, shown ONLY when a password is
//   set and it has been present for ~365 days. A reminder, never a forced reset.
//
// Both NUDGE, they never STRAND: they never block use, skipping never locks the
// account, and dismissing just records the time so the prompt stays rare and does
// not reappear immediately. Everyday unlock is biometrics/passkey, so these are
// intentionally rare, not a tax on each open.
//
// The cadence lives DEVICE-LOCAL (localStorage), like starred contacts and the
// keep-signed-in choice: it is timing, not account data, so it adds nothing to the
// synced blob and no server-visible signal. Timestamps are epoch ms; tests inject
// `now` so elapsed time is deterministic (core/clock is the only wall-clock edge).

// Show the phrase rehearsal about twice a year. Rare by design: the phrase does not
// change, so this is muscle-memory upkeep, not a task.
export const PHRASE_REHEARSAL_INTERVAL_MS = 182 * DAY_MS;

// The password refresh suggestion fires once its factor has been present for a year
// (doc 32: "unchanged for 365 days"). We track "present since first seen on this
// device" rather than a true change date, because no set/changed timestamp is
// stored server-side or in the blob (the envelope is opaque ciphertext). This is a
// deliberate, minimal approximation: on a device that has held the password all
// along it matches the real age; a device that only just saw the password starts its
// own year. TODO(doc 32): if a server-side envelope timestamp is ever added, prefer
// it over this device-local first-seen so the reminder tracks the real change date.
export const PASSWORD_REFRESH_AGE_MS = 365 * DAY_MS;

// After the yearly password suggestion is dismissed, wait this long before it could
// come back, so a "remind me later" is not nagging. Still rare, still dismissible.
export const PASSWORD_REDISMISS_INTERVAL_MS = 182 * DAY_MS;

const KEY = "sti.continuity.v1";

/** The persisted cadence record. All fields optional so an older/partial record
 * still reads (fail-open to "never shown"). Times are epoch ms. */
interface ContinuityState {
  /** When the phrase rehearsal was last shown-and-dismissed. */
  readonly phraseLastMs?: number;
  /** When the password refresh suggestion was last shown-and-dismissed. */
  readonly passwordLastMs?: number;
  /** When this device first observed that a password factor is set. */
  readonly passwordFirstSeenMs?: number;
}

/** Which nudge to show, or null when none is due. Only one shows at a time so the
 * surface stays calm. */
export type ContinuityNudge = "phrase" | "password";

function readNumber(o: Record<string, unknown>, k: string): number | undefined {
  const v = o[k];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function load(storage: StorageLike): ContinuityState {
  try {
    const raw = storage.getItem(KEY);
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    const o = parsed as Record<string, unknown>;
    const phraseLastMs = readNumber(o, "phraseLastMs");
    const passwordLastMs = readNumber(o, "passwordLastMs");
    const passwordFirstSeenMs = readNumber(o, "passwordFirstSeenMs");
    return {
      ...(phraseLastMs !== undefined ? { phraseLastMs } : {}),
      ...(passwordLastMs !== undefined ? { passwordLastMs } : {}),
      ...(passwordFirstSeenMs !== undefined ? { passwordFirstSeenMs } : {}),
    };
  } catch {
    return {};
  }
}

function save(storage: StorageLike, state: ContinuityState): void {
  try {
    storage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Best-effort: an unavailable store just means the nudge may recur; it never
    // blocks or errors.
  }
}

/** Inputs to the "is a nudge due?" decision. `passwordSet` is whether the account
 * currently has a password factor (a non-null recovery name). `now` is injected. */
export interface ContinuityInputs {
  readonly passwordSet: boolean;
  readonly now?: number;
}

// Whether the phrase rehearsal is due: never shown, or shown longer ago than the
// interval.
function phraseDue(state: ContinuityState, now: number): boolean {
  const last = state.phraseLastMs;
  return last === undefined || now - last >= PHRASE_REHEARSAL_INTERVAL_MS;
}

// Whether the yearly password suggestion is due: a password is set, it has been
// present here for the full age, and it was not dismissed within the re-dismiss
// window. Never fires when no password is set.
function passwordDue(
  state: ContinuityState,
  passwordSet: boolean,
  now: number,
): boolean {
  if (!passwordSet) return false;
  const firstSeen = state.passwordFirstSeenMs;
  if (firstSeen === undefined || now - firstSeen < PASSWORD_REFRESH_AGE_MS) {
    return false;
  }
  const last = state.passwordLastMs;
  return last === undefined || now - last >= PASSWORD_REDISMISS_INTERVAL_MS;
}

// Keep the device-local "password first seen" mark in step with reality: stamp it
// the first time we see a password set, and clear it when the password is gone (so a
// later re-enable starts a fresh year rather than firing immediately). Returns the
// possibly-updated state; persists only when it changed.
function syncPasswordSeen(
  storage: StorageLike,
  state: ContinuityState,
  passwordSet: boolean,
  now: number,
): ContinuityState {
  if (passwordSet && state.passwordFirstSeenMs === undefined) {
    const next = { ...state, passwordFirstSeenMs: now };
    save(storage, next);
    return next;
  }
  if (!passwordSet && state.passwordFirstSeenMs !== undefined) {
    const rest: ContinuityState = {
      ...(state.phraseLastMs !== undefined
        ? { phraseLastMs: state.phraseLastMs }
        : {}),
      ...(state.passwordLastMs !== undefined
        ? { passwordLastMs: state.passwordLastMs }
        : {}),
    };
    save(storage, rest);
    return rest;
  }
  return state;
}

/**
 * The pure decision: which continuity nudge (if any) is due right now. Password
 * takes priority when both are due, because it is tied to a specific one-year event
 * and is the rarer prompt; the phrase rehearsal comes back on its own next cycle.
 * Reading also stamps the password first-seen mark, so the year starts counting the
 * moment a password is observed.
 */
export function dueNudge(
  storage: StorageLike,
  { passwordSet, now = nowMs() }: ContinuityInputs,
): ContinuityNudge | null {
  const synced = syncPasswordSeen(storage, load(storage), passwordSet, now);
  if (passwordDue(synced, passwordSet, now)) return "password";
  if (phraseDue(synced, now)) return "phrase";
  return null;
}

/** Record that a nudge was shown-and-dismissed, so it stays rare and does not
 * reappear immediately. A no-op-safe write: an unavailable store never throws. */
export function dismissNudge(
  storage: StorageLike,
  kind: ContinuityNudge,
  now: number = nowMs(),
): void {
  const state = load(storage);
  const next: ContinuityState =
    kind === "phrase"
      ? { ...state, phraseLastMs: now }
      : { ...state, passwordLastMs: now };
  save(storage, next);
}

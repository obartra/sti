import type { StorageLike } from "../../auth/deviceStore.ts";
import { nowMs, DAY_MS } from "../../core/clock.ts";

// Continuity nudges (doc 32, "Keeping the recovery factor memorized"). Two gentle,
// dismissible reminders that help the owner keep their way back into the account:
//
// - A rare recovery-phrase rehearsal ("can you still find it?"). Because the phrase
//   is always the backstop, this is a rehearsal, never a lockout.
// - A once-a-year suggestion to refresh a password, shown ONLY when a password is
//   set and it was last set or changed ~365 days ago. A reminder, never a forced reset.
//
// Both NUDGE, they never STRAND: they never block use, skipping never locks the
// account, and dismissing just records the time so the prompt stays rare and does
// not reappear immediately. Everyday unlock is biometrics/passkey, so these are
// intentionally rare, not a tax on each open.
//
// The DISMISSAL cadence (when each nudge was last shown-and-dismissed) lives
// DEVICE-LOCAL (localStorage), like starred contacts and the keep-signed-in choice:
// it is per-device timing, not account data, so it adds nothing to the synced blob
// and no server-visible signal. The password's AGE, by contrast, comes from
// `passwordSetAt` in the synced account blob (doc 32): a real set/changed date that
// follows the owner across devices, so a device that only just saw the password does
// not restart the year. Timestamps are epoch ms; tests inject `now` so elapsed time
// is deterministic (core/clock is the only wall-clock edge).

// Show the phrase rehearsal about twice a year. Rare by design: the phrase does not
// change, so this is muscle-memory upkeep, not a task.
export const PHRASE_REHEARSAL_INTERVAL_MS = 182 * DAY_MS;

// The password refresh suggestion fires once the factor has been set or changed for
// a year (doc 32: "unchanged for 365 days"). The age comes from `passwordSetAt` in
// the synced blob, a real set/changed date, so it is the same on every device and a
// change resets the year everywhere.
export const PASSWORD_REFRESH_AGE_MS = 365 * DAY_MS;

// After the yearly password suggestion is dismissed, wait this long before it could
// come back, so a "remind me later" is not nagging. Still rare, still dismissible.
export const PASSWORD_REDISMISS_INTERVAL_MS = 182 * DAY_MS;

const KEY = "sti.continuity.v1";

/** The persisted DISMISSAL cadence. All fields optional so an older/partial record
 * still reads (fail-open to "never shown"). Times are epoch ms. The password's age
 * is not here: it comes from the synced blob's `passwordSetAt`, not this device. */
interface ContinuityState {
  /** When the phrase rehearsal was last shown-and-dismissed. */
  readonly phraseLastMs?: number;
  /** When the password refresh suggestion was last shown-and-dismissed. */
  readonly passwordLastMs?: number;
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
    return {
      ...(phraseLastMs !== undefined ? { phraseLastMs } : {}),
      ...(passwordLastMs !== undefined ? { passwordLastMs } : {}),
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

/** Inputs to the "is a nudge due?" decision. `passwordSetAt` is when the account's
 * password was set or changed (the synced blob's `passwordSetAt`, doc 32), or
 * undefined when no password is set, in which case the yearly reminder never fires.
 * `now` is injected. */
export interface ContinuityInputs {
  readonly passwordSetAt?: number;
  readonly now?: number;
}

// Whether the phrase rehearsal is due: never shown, or shown longer ago than the
// interval.
function phraseDue(state: ContinuityState, now: number): boolean {
  const last = state.phraseLastMs;
  return last === undefined || now - last >= PHRASE_REHEARSAL_INTERVAL_MS;
}

// Whether the yearly password suggestion is due: a password is set with its
// set/changed date (`passwordSetAt`), that date is a full year old, and the nudge was
// not dismissed within the re-dismiss window. An absent `passwordSetAt` means no
// password is set, so the reminder is never due. The date rides the synced blob, so
// turning the password off and on (or changing it) writes a fresh `passwordSetAt`
// and the year restarts on every device.
function passwordDue(
  state: ContinuityState,
  passwordSetAt: number | undefined,
  now: number,
): boolean {
  if (
    passwordSetAt === undefined ||
    now - passwordSetAt < PASSWORD_REFRESH_AGE_MS
  ) {
    return false;
  }
  const last = state.passwordLastMs;
  return last === undefined || now - last >= PASSWORD_REDISMISS_INTERVAL_MS;
}

/**
 * The pure decision: which continuity nudge (if any) is due right now. Password
 * takes priority when both are due, because it is tied to a specific one-year event
 * and is the rarer prompt; the phrase rehearsal comes back on its own next cycle. The
 * password's age is read from `passwordSetAt` (the synced blob), not this device, so
 * the reminder tracks the real change date wherever the owner is.
 */
export function dueNudge(
  storage: StorageLike,
  { passwordSetAt, now = nowMs() }: ContinuityInputs,
): ContinuityNudge | null {
  const state = load(storage);
  if (passwordDue(state, passwordSetAt, now)) return "password";
  if (phraseDue(state, now)) return "phrase";
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

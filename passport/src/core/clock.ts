/**
 * The on-device day clock. Time enters the badge model as a whole-day count
 * since the Unix epoch (UTC), never a wall-clock instant: the badge's windows
 * (90-day freshness, clearance) are day-granular, and a day count keeps the pure
 * core (computeBadge) deterministic and testable. "Now" is read ONLY at the app
 * and store edges via {@link todayEpochDay}; the core takes the day as a
 * parameter, so a test pins time by passing an explicit day.
 *
 * Days are UTC so the same instant maps to the same day on every device, and a
 * stored last-test day means the same thing wherever the account is recovered.
 * The exact local midnight is not material to a 90-day window.
 */

const MS_PER_DAY = 86_400_000;

/** Milliseconds in an hour / a day, for absolute link-expiry math (doc 16). */
export const HOUR_MS = 3_600_000;
export const DAY_MS = MS_PER_DAY;

/** Whole days since the Unix epoch (UTC) for an epoch-millisecond instant. */
export function toEpochDay(epochMs: number): number {
  return Math.floor(epochMs / MS_PER_DAY);
}

/** Today as a UTC epoch-day count. The single point that reads the wall clock. */
export function todayEpochDay(): number {
  return toEpochDay(Date.now());
}

/**
 * Now as an absolute epoch-ms instant. The clock edge for link expiry, which is
 * sub-day (doc 16) and so can't use the day-granular badge clock above.
 */
export function nowMs(): number {
  return Date.now();
}

/**
 * A short owner-facing label for how long a link has left, from its absolute
 * expiry (epoch ms) or null for no expiry. Coarse and approximate: sub-hour reads
 * as minutes, then hours, then days. Used only for the owner's own link list,
 * never anything a viewer sees.
 */
export function expiryLabel(expiresAt: number | null, now: number): string {
  if (expiresAt === null) return "No expiry";
  const left = expiresAt - now;
  if (left <= 0) return "Expired";
  if (left < HOUR_MS)
    return `${Math.max(1, Math.round(left / 60_000))} min left`;
  if (left < DAY_MS) return `${Math.round(left / HOUR_MS)}h left`;
  const days = Math.round(left / DAY_MS);
  return days === 1 ? "1 day left" : `${days} days left`;
}

/** The Date at the start (UTC midnight) of an epoch day, for display formatting. */
export function epochDayToDate(day: number): Date {
  return new Date(day * MS_PER_DAY);
}

/**
 * An epoch day as a `YYYY-MM-DD` string (UTC), the value format a native
 * `<input type="date">` reads and writes. Pairs with {@link isoDateToEpochDay}.
 */
export function epochDayToISODate(day: number): string {
  return epochDayToDate(day).toISOString().slice(0, 10);
}

/**
 * Parse a `YYYY-MM-DD` date input value back to a UTC epoch day, or null when the
 * string is empty or unparseable (e.g. the field was cleared). Date-only strings
 * parse as UTC midnight by spec, so this round-trips {@link epochDayToISODate}.
 */
export function isoDateToEpochDay(iso: string): number | null {
  if (iso === "") return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : toEpochDay(ms);
}

/**
 * A coarse "when" label for a past day relative to today (Today / Yesterday /
 * N days / N weeks / N months ago). Day-granular and approximate by design; used
 * for owner-facing recency (e.g. a linkup's last-seen), never anything a viewer
 * reads. A future or same day reads as "Today".
 */
export function relativeDayLabel(day: number, today: number): string {
  const d = today - day;
  if (d <= 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d} days ago`;
  if (d < 14) return "1 week ago";
  if (d < 30) return `${Math.floor(d / 7)} weeks ago`;
  if (d < 60) return "1 month ago";
  return `${Math.floor(d / 30)} months ago`;
}

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

/** Whole days since the Unix epoch (UTC) for an epoch-millisecond instant. */
export function toEpochDay(epochMs: number): number {
  return Math.floor(epochMs / MS_PER_DAY);
}

/** Today as a UTC epoch-day count. The single point that reads the wall clock. */
export function todayEpochDay(): number {
  return toEpochDay(Date.now());
}

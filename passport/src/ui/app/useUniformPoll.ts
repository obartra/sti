import { useEffect } from "react";

/**
 * The uniform scheduled partner-notify poll (doc 13, doc 03 section 10). It fires the
 * owner-pull on a FIXED, jittered cadence, unconditionally, whether or not a nudge is
 * present, so poll timing carries no notify signal.
 *
 * Why nudge-blind: the recipient poll path already emits no server write (see
 * consumePartnerPing), so a poll is byte-identical for recipients and non-recipients.
 * The remaining signal a server could read is WHEN a device polls. If the poll sped
 * up, backed off, or stopped once a ping was found, that change in cadence would leak
 * that this device is the recipient. So this timer NEVER keys on nudge state: it runs
 * on its constant cadence forever, the same for a device with a waiting ping and one
 * without. It deliberately ignores the poll's result.
 *
 * Cadence is a coarse, tunable client constant: partner-notify is a get-screened
 * nudge, not a real-time alarm (doc 03 section 10), so hours-scale polling is
 * sanctioned. Jitter spreads the tick off any fixed wall-clock grid and off the
 * reconnect/foreground and group polls, so the scheduled reads do not stampede.
 *
 * The timer only runs while a tab is alive; a returning device is caught up by the
 * reconnect/foreground pull (useCatchup), which stays as an additional floor. A
 * logged-out (`active` false) app runs no timer.
 */

// Default ~6 hours between scheduled polls, with +/- 30 minutes of jitter. Dial
// these to change how often every device polls; both are pure cadence and carry no
// per-device or per-nudge state, so changing them cannot leak a notify signal.
export const UNIFORM_POLL_INTERVAL_MS = 6 * 60 * 60 * 1000;
export const UNIFORM_POLL_JITTER_MS = 30 * 60 * 1000;

// The next delay: the fixed interval plus a symmetric random jitter in
// [-JITTER, +JITTER]. Never references nudge state, so the cadence is constant in
// distribution for every device.
function nextDelayMs(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  const r = (buf[0] ?? 0) / 0x1_0000_0000; // [0, 1)
  const jitter = Math.floor((r * 2 - 1) * UNIFORM_POLL_JITTER_MS);
  return UNIFORM_POLL_INTERVAL_MS + jitter;
}

/**
 * Run `refresh` on a fixed, jittered cadence while `active`. The cadence never
 * changes in response to what `refresh` finds; the poll result is intentionally
 * unread here.
 */
export function useUniformPoll(active: boolean, refresh: () => void): void {
  useEffect(() => {
    if (!active) return;
    let timer: ReturnType<typeof setTimeout>;
    const tick = (): void => {
      // Fire unconditionally, then reschedule on the same cadence regardless of the
      // outcome. No back-off, no acceleration, no stop-on-found: that is the point.
      refresh();
      timer = setTimeout(tick, nextDelayMs());
    };
    timer = setTimeout(tick, nextDelayMs());
    return () => clearTimeout(timer);
  }, [active, refresh]);
}

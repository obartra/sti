// @vitest-environment node
import { describe, it, expect } from "vitest";
import type { StorageLike } from "../../auth/deviceStore.ts";
import { DAY_MS } from "../../core/clock.ts";
import {
  dueNudge,
  dismissNudge,
  PHRASE_REHEARSAL_INTERVAL_MS,
  PASSWORD_REFRESH_AGE_MS,
  PASSWORD_REDISMISS_INTERVAL_MS,
} from "./continuityNudge.ts";

function memory(seed: Record<string, string> = {}): StorageLike {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

// A fixed "now" far enough from the epoch that intervals never go negative.
const T0 = 2_000 * DAY_MS;

describe("continuity nudge cadence", () => {
  it("shows the phrase rehearsal on a fresh device (never shown before)", () => {
    const store = memory();
    expect(dueNudge(store, { now: T0 })).toBe("phrase");
  });

  it("does not re-show the phrase rehearsal right after dismissing it", () => {
    const store = memory();
    dismissNudge(store, "phrase", T0);
    expect(dueNudge(store, { now: T0 })).toBeNull();
    // A day later is still far too soon.
    expect(dueNudge(store, { now: T0 + DAY_MS })).toBeNull();
  });

  it("shows the phrase rehearsal again only after the full interval", () => {
    const store = memory();
    dismissNudge(store, "phrase", T0);
    const justBefore = T0 + PHRASE_REHEARSAL_INTERVAL_MS - DAY_MS;
    expect(dueNudge(store, { now: justBefore })).toBeNull();
    const due = T0 + PHRASE_REHEARSAL_INTERVAL_MS;
    expect(dueNudge(store, { now: due })).toBe("phrase");
  });

  it("never shows the password reminder when no password is set", () => {
    const store = memory();
    // Even long after any age, no passwordSetAt means no password reminder.
    const far = T0 + PASSWORD_REFRESH_AGE_MS * 3;
    // Dismiss the phrase so it does not mask the (absent) password result.
    dismissNudge(store, "phrase", far);
    expect(dueNudge(store, { now: far })).toBeNull();
  });

  it("does not show the password reminder until the factor has aged a year", () => {
    const store = memory();
    // The password was set at T0; dismiss the phrase so it does not mask the
    // password result.
    dismissNudge(store, "phrase", T0);
    expect(dueNudge(store, { passwordSetAt: T0, now: T0 })).toBeNull();
    // Just under a year: the password reminder is not due (the phrase rehearsal may
    // be, on its own faster cadence, so assert specifically that it is not password).
    const justBefore = T0 + PASSWORD_REFRESH_AGE_MS - DAY_MS;
    expect(dueNudge(store, { passwordSetAt: T0, now: justBefore })).not.toBe(
      "password",
    );
  });

  it("shows the password reminder once the factor has been set a year", () => {
    const store = memory();
    dismissNudge(store, "phrase", T0);
    const aged = T0 + PASSWORD_REFRESH_AGE_MS;
    expect(dueNudge(store, { passwordSetAt: T0, now: aged })).toBe("password");
  });

  it("password takes priority over an also-due phrase rehearsal", () => {
    const store = memory();
    const aged = T0 + PASSWORD_REFRESH_AGE_MS;
    // Both are due here (phrase never shown, password set a year ago).
    expect(dueNudge(store, { passwordSetAt: T0, now: aged })).toBe("password");
  });

  it("does not re-show the password reminder right after dismissing it", () => {
    const store = memory();
    const aged = T0 + PASSWORD_REFRESH_AGE_MS;
    dismissNudge(store, "password", aged);
    dismissNudge(store, "phrase", aged);
    expect(dueNudge(store, { passwordSetAt: T0, now: aged })).toBeNull();
    const soon = aged + PASSWORD_REDISMISS_INTERVAL_MS - DAY_MS;
    expect(dueNudge(store, { passwordSetAt: T0, now: soon })).toBeNull();
  });

  it("re-arms the password year from a fresh set date when changed", () => {
    const store = memory();
    // A password changed much later carries a newer passwordSetAt, so it is not
    // instantly "a year old" even though the account has held one for ages.
    const reSet = T0 + PASSWORD_REFRESH_AGE_MS * 2;
    // Dismiss the phrase at reSet so it does not mask the (absent) password result.
    dismissNudge(store, "phrase", reSet);
    expect(dueNudge(store, { passwordSetAt: reSet, now: reSet })).toBeNull();
  });

  it("never fires the password nudge without a set date (no password set)", () => {
    const store = memory();
    dismissNudge(store, "phrase", T0);
    // No passwordSetAt means no password: the yearly reminder is never due, even
    // far in the future.
    const far = T0 + PASSWORD_REFRESH_AGE_MS * 3;
    dismissNudge(store, "phrase", far);
    expect(dueNudge(store, { now: far })).toBeNull();
  });

  it("ignores a malformed stored record and treats it as never shown", () => {
    const store = memory({ "sti.continuity.v1": "not json {" });
    expect(dueNudge(store, { now: T0 })).toBe("phrase");
  });
});

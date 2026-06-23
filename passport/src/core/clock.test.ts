// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  toEpochDay,
  todayEpochDay,
  relativeDayLabel,
  epochDayToISODate,
  isoDateToEpochDay,
} from "./clock.ts";

describe("epoch day", () => {
  it("counts whole UTC days since the epoch", () => {
    expect(toEpochDay(0)).toBe(0);
    expect(toEpochDay(86_400_000 - 1)).toBe(0); // last ms of day 0
    expect(toEpochDay(86_400_000)).toBe(1); // first ms of day 1
    expect(toEpochDay(2 * 86_400_000 + 5)).toBe(2);
  });

  it("is monotonic and stable within a day", () => {
    const noonDay10 = 10 * 86_400_000 + 43_200_000;
    expect(toEpochDay(noonDay10)).toBe(10);
    expect(toEpochDay(noonDay10 + 1)).toBe(10);
  });

  it("todayEpochDay is a non-negative integer", () => {
    const d = todayEpochDay();
    expect(Number.isInteger(d)).toBe(true);
    expect(d).toBeGreaterThan(0);
  });
});

describe("ISO date round-trip", () => {
  it("formats an epoch day as a UTC YYYY-MM-DD string", () => {
    expect(epochDayToISODate(0)).toBe("1970-01-01");
    expect(epochDayToISODate(1)).toBe("1970-01-02");
    // 2026-06-22 is day 20626 since the epoch.
    expect(epochDayToISODate(20626)).toBe("2026-06-22");
  });

  it("parses a date-input value back to the same epoch day", () => {
    expect(isoDateToEpochDay("1970-01-01")).toBe(0);
    expect(isoDateToEpochDay("2026-06-22")).toBe(20626);
    for (const day of [0, 1, 19710, 20626, 25000]) {
      expect(isoDateToEpochDay(epochDayToISODate(day))).toBe(day);
    }
  });

  it("returns null for an empty or unparseable value", () => {
    expect(isoDateToEpochDay("")).toBeNull();
    expect(isoDateToEpochDay("not-a-date")).toBeNull();
  });
});

describe("relativeDayLabel", () => {
  const today = 1000;
  it("buckets a past day into a coarse label", () => {
    expect(relativeDayLabel(1000, today)).toBe("Today");
    expect(relativeDayLabel(1001, today)).toBe("Today"); // future reads as today
    expect(relativeDayLabel(999, today)).toBe("Yesterday");
    expect(relativeDayLabel(996, today)).toBe("4 days ago");
    expect(relativeDayLabel(990, today)).toBe("1 week ago");
    expect(relativeDayLabel(983, today)).toBe("2 weeks ago");
    expect(relativeDayLabel(965, today)).toBe("1 month ago");
    expect(relativeDayLabel(900, today)).toBe("3 months ago");
  });
});

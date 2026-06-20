// @vitest-environment node
import { describe, it, expect } from "vitest";
import { toEpochDay, todayEpochDay } from "./clock.ts";

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

import { describe, it, expect } from "vitest";
import { reconnectJitterMs } from "./jitter.ts";

describe("reconnectJitterMs", () => {
  it("returns a delay within the 0..15s window", () => {
    for (let i = 0; i < 200; i++) {
      const d = reconnectJitterMs();
      expect(Number.isInteger(d)).toBe(true);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThan(15_000);
    }
  });

  it("varies (is not a fixed offset)", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 50; i++) seen.add(reconnectJitterMs());
    expect(seen.size).toBeGreaterThan(1);
  });
});

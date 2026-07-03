// @vitest-environment node
import { describe, it, expect } from "vitest";
import { expiryLabel } from "./ShareSheet.lifetime.tsx";
import { DAY_MS } from "../../core/clock.ts";

describe("expiryLabel", () => {
  const now = 1_000_000_000_000;

  it("renders nothing for a link with no expiry", () => {
    expect(expiryLabel(null, now)).toBeNull();
    expect(expiryLabel(undefined, now)).toBeNull();
  });

  it("counts whole days up, so any time left today still reads as today", () => {
    expect(expiryLabel(now + 1, now)).toBe("Expires today");
    expect(expiryLabel(now + DAY_MS, now)).toBe("Expires today");
    expect(expiryLabel(now + DAY_MS + 1, now)).toBe("Expires tomorrow");
    expect(expiryLabel(now + 2 * DAY_MS, now)).toBe("Expires tomorrow");
    expect(expiryLabel(now + 2 * DAY_MS + 1, now)).toBe("Expires in 3 days");
    expect(expiryLabel(now + 7 * DAY_MS, now)).toBe("Expires in 7 days");
    expect(expiryLabel(now + 30 * DAY_MS, now)).toBe("Expires in 30 days");
  });

  it("reads as expired at and past the instant", () => {
    expect(expiryLabel(now, now)).toBe("Expired");
    expect(expiryLabel(now - 1, now)).toBe("Expired");
  });
});

import { describe, it, expect, afterEach, vi } from "vitest";
import {
  readAdminToken,
  saveAdminToken,
  clearAdminToken,
} from "./adminToken.ts";

afterEach(() => {
  // Restore any sessionStorage spy BEFORE clearing, or clear() hits the throwing
  // getter the last test installed.
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe("adminToken", () => {
  it("round-trips through sessionStorage and clears", () => {
    expect(readAdminToken()).toBeNull();
    saveAdminToken("tok-123");
    expect(readAdminToken()).toBe("tok-123");
    clearAdminToken();
    expect(readAdminToken()).toBeNull();
  });

  it("degrades to null when sessionStorage access throws", () => {
    vi.spyOn(globalThis, "sessionStorage", "get").mockImplementation(() => {
      throw new Error("blocked");
    });
    // None of these throw; read returns null and save/clear are no-ops.
    expect(readAdminToken()).toBeNull();
    expect(() => saveAdminToken("x")).not.toThrow();
    expect(() => clearAdminToken()).not.toThrow();
  });
});

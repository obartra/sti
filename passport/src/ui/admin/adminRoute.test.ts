import { describe, it, expect, afterEach } from "vitest";
import { isAdminPath } from "./adminRoute.ts";

afterEach(() => {
  window.history.replaceState({}, "", "/");
});

describe("isAdminPath", () => {
  it("matches /admin and /admin/ only", () => {
    window.history.replaceState({}, "", "/admin");
    expect(isAdminPath()).toBe(true);
    window.history.replaceState({}, "", "/admin/");
    expect(isAdminPath()).toBe(true);
  });

  it("does not match other paths, including admin substrings", () => {
    for (const p of [
      "/",
      "/home",
      "/administer",
      "/admin/reports",
      "/a/admin",
    ]) {
      window.history.replaceState({}, "", p);
      expect(isAdminPath()).toBe(false);
    }
  });
});

import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { findableNameFromPath, useAppRouter } from "./useAppRouter.ts";
import { groupOf } from "./routes.ts";

describe("findableNameFromPath", () => {
  it("extracts and normalizes the name from /u/{name}", () => {
    expect(findableNameFromPath("/u/robin")).toBe("robin");
    expect(findableNameFromPath("/u/RoBiN")).toBe("robin"); // normalized
    expect(findableNameFromPath("/u/robin/")).toBe("robin"); // trailing slash
    expect(findableNameFromPath("/u/free_money")).toBe("free_money");
  });

  it("returns null for non-/u paths and extra segments", () => {
    for (const p of ["/", "/home", "/a/robin", "/exposed", "/u/", "/u/a/b"]) {
      expect(findableNameFromPath(p)).toBeNull();
    }
  });

  it("fails closed on a malformed percent-encoding instead of throwing", () => {
    // decodeURIComponent would throw on these; the helper must not.
    expect(() => findableNameFromPath("/u/%E0%A4%A")).not.toThrow();
    expect(() => findableNameFromPath("/u/%")).not.toThrow();
    // It still returns a (normalized) string the resolve step will 404 on.
    expect(findableNameFromPath("/u/%")).toBe("%");
  });

  it("decodes a valid percent-encoded segment", () => {
    expect(findableNameFromPath("/u/ro%62in")).toBe("robin"); // %62 = 'b'
  });
});

describe("the /promises path", () => {
  it("routes to the in-app promises page in the public group (anonymous-reachable)", () => {
    window.history.pushState({}, "", "/promises");
    try {
      const { result } = renderHook(() => useAppRouter());
      expect(result.current.route.screen).toBe("promises");
      expect(result.current.route.group).toBe("public");
    } finally {
      window.history.pushState({}, "", "/");
    }
  });

  it("keeps promises in the public group, so the login gate never clamps it", () => {
    // App.tsx clamps app-group screens to the landing when logged out; a public
    // group is what lets an anonymous visitor see /promises.
    expect(groupOf("promises")).toBe("public");
  });
});

import { describe, it, expect } from "vitest";
import { findableNameFromPath } from "./useAppRouter.ts";

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

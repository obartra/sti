import { describe, it, expect } from "vitest";
import { isScreen, groupOf, isTab } from "./routes.ts";

// The trust pages (doc 23) must be public-group, full-page screens so the landing
// footer can reach them logged out. If one slipped back into the app group it
// would render inside the tab shell and break for a logged-out visitor.
describe("trust pages are public, full-page screens", () => {
  const TRUST = ["promises", "privacy-policy", "terms"] as const;

  it.each(TRUST)("%s is a known screen in the public group", (id) => {
    expect(isScreen(id)).toBe(true);
    expect(groupOf(id)).toBe("public");
    expect(isTab(id)).toBe(false);
  });
});

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Promises, THEMES } from "./Promises.tsx";
import { PROMISES, type UserPromise } from "../../promises/promises.ts";

const byId = new Map(PROMISES.map((p) => [p.id, p]));
function promisesOf(themeIndex: number): UserPromise[] {
  const theme = THEMES[themeIndex];
  if (theme === undefined) throw new Error("no such theme");
  return theme.promiseIds
    .map((id) => byId.get(id))
    .filter((p): p is UserPromise => p !== undefined);
}

// The promises DATA is gated hard by promises.test.ts (each promise pinned to a real
// test). This pins the RENDERING layer (doc 23 step 5): the page mirrors the legal
// layered-notice layout, every guarantee and its honest detail shows, and each check
// is honestly labeled test-backed vs by-design, so a regression in the page can't
// quietly drop or mislabel a promise.
describe("Promises page", () => {
  it("renders the heading and every guarantee with its honest detail", () => {
    render(<Promises />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Our promises" }),
    ).toBeInTheDocument();

    // Every promise's plain guarantee and its honest detail show exactly once.
    for (const p of PROMISES) {
      expect(screen.getByText(p.plain)).toBeInTheDocument();
      expect(screen.getByText(p.detail)).toBeInTheDocument();
    }
  });

  it("groups the promises under their three themes, each with its summary", () => {
    render(<Promises />);
    for (const theme of THEMES) {
      expect(
        screen.getByRole("heading", { level: 2, name: theme.headline }),
      ).toBeInTheDocument();
      expect(screen.getByText(theme.summary)).toBeInTheDocument();
    }
  });

  it("shows every check, labeled by how it is backed", () => {
    render(<Promises />);
    const label = /^(tested|by design)$/;
    const allAssertions = PROMISES.reduce((n, p) => n + p.assertions.length, 0);
    expect(screen.getAllByText(label)).toHaveLength(allAssertions);

    // A "test" backing reads "tested"; a "reasoning" backing reads "by design".
    const tested = PROMISES.reduce(
      (n, p) =>
        n + p.assertions.filter((a) => a.backedBy.kind === "test").length,
      0,
    );
    expect(screen.queryAllByText(/^tested$/)).toHaveLength(tested);

    // Sanity-check the grouping helper stays wired to the same data.
    expect(promisesOf(0).length).toBeGreaterThan(0);
  });
});

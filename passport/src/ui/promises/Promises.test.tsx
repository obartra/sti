import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
// test). This pins the RENDERING layer (doc 23 step 5): the page is a progressive
// summary, every guarantee shows once its theme is opened, the checks stay hidden
// until then, and each is honestly labeled test-backed vs by-design, so a regression
// in the page can't quietly drop or mislabel a promise.
describe("Promises page", () => {
  it("renders the heading and reveals every guarantee once its theme is opened", async () => {
    const user = userEvent.setup();
    render(<Promises />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Our promises" }),
    ).toBeInTheDocument();

    // Promises live inside collapsible themes, hidden until opened.
    for (const p of PROMISES) {
      expect(screen.queryByText(p.plain)).toBeNull();
    }

    // Open every theme; then every guarantee + its honest detail shows exactly once.
    const toggles = screen.getAllByRole("button", {
      name: /see the specifics/i,
    });
    expect(toggles).toHaveLength(THEMES.length);
    for (const t of toggles) await user.click(t);
    for (const p of PROMISES) {
      expect(screen.getByText(p.plain)).toBeInTheDocument();
      expect(screen.getByText(p.detail)).toBeInTheDocument();
    }
  });

  it("hides the checks until a theme is expanded, then labels each one", async () => {
    const user = userEvent.setup();
    render(<Promises />);
    const label = /^(tested|by design)$/;
    // Collapsed: no per-assertion backing label is shown.
    expect(screen.queryAllByText(label)).toHaveLength(0);

    // Expanding the first theme reveals exactly its member promises' assertions,
    // each labeled by how it is backed (a "test" -> "tested", "reasoning" -> "by
    // design").
    const [firstToggle] = screen.getAllByRole("button", {
      name: /see the specifics/i,
    });
    if (firstToggle === undefined) throw new Error("no theme expand control");
    await user.click(firstToggle);

    const first = promisesOf(0);
    const assertionCount = first.reduce((n, p) => n + p.assertions.length, 0);
    expect(screen.getAllByText(label)).toHaveLength(assertionCount);
    const testedCount = first.reduce(
      (n, p) =>
        n + p.assertions.filter((a) => a.backedBy.kind === "test").length,
      0,
    );
    expect(screen.queryAllByText(/^tested$/)).toHaveLength(testedCount);
  });
});

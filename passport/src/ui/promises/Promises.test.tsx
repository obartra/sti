import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { Promises } from "./Promises.tsx";
import { PROMISES } from "../../promises/promises.ts";

// The promises DATA is gated hard by promises.test.ts (each promise pinned to a real
// test). This pins the RENDERING layer (doc 23 step 5): every guarantee shows, the
// checks stay hidden until asked for, and each is honestly labeled test-backed vs
// by-design, so a regression in the page can't quietly drop or mislabel a promise.
describe("Promises page", () => {
  it("renders the heading and every promise's plain-English guarantee", () => {
    render(<Promises />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Our promises" }),
    ).toBeInTheDocument();
    for (const p of PROMISES) {
      expect(screen.getByText(p.plain)).toBeInTheDocument();
      expect(screen.getByText(p.detail)).toBeInTheDocument();
    }
  });

  it("hides the checks until a card is expanded, then labels each one", async () => {
    const user = userEvent.setup();
    render(<Promises />);
    const label = /^(tested|by design)$/;
    // Collapsed: no per-assertion backing label is shown.
    expect(screen.queryAllByText(label)).toHaveLength(0);

    // Expanding the first card reveals exactly its assertions, each labeled by how it
    // is backed (a "test" assertion -> "tested", a "reasoning" one -> "by design").
    const [first] = PROMISES;
    if (first === undefined) throw new Error("no promises to render");
    const [firstToggle] = screen.getAllByRole("button", {
      name: /what we actually check/i,
    });
    if (firstToggle === undefined) throw new Error("no expand control");
    await user.click(firstToggle);
    expect(screen.getAllByText(label)).toHaveLength(first.assertions.length);
    const testedCount = first.assertions.filter(
      (a) => a.backedBy.kind === "test",
    ).length;
    expect(screen.queryAllByText(/^tested$/)).toHaveLength(testedCount);
  });
});

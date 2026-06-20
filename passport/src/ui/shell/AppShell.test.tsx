import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { AppTopBar } from "./AppShell.tsx";

describe("AppTopBar knock indicator", () => {
  it("flags new activity on the bell only when there are knocks", () => {
    const { rerender } = render(<AppTopBar />);
    // No knocks: a plain notifications bell.
    expect(
      screen.getByRole("button", { name: "Notifications" }),
    ).toBeInTheDocument();

    // Knocks present: the quiet indicator (surfaced to a11y, no count exposed).
    rerender(<AppTopBar hasKnocks />);
    const bell = screen.getByRole("button", {
      name: "Notifications (new activity)",
    });
    expect(bell).toBeInTheDocument();
    expect(bell.textContent).not.toMatch(/\d/); // never a count
  });
});

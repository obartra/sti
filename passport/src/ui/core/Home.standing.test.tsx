import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { StandingCard } from "./Home.standing.tsx";

const blue = {
  recentPanel: true,
  clear: true,
  route: true,
  willBeBlue: true,
} as const;

describe("StandingCard (where you stand)", () => {
  it("hides the breakdown behind a reveal by default, then shows it on tap", () => {
    render(
      <StandingCard
        standing={blue}
        daysLeft={40}
        tested
        onFindTesting={() => undefined}
      />,
    );
    // The title and the way to testing are always visible.
    expect(screen.getByText("Where you stand")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Find testing" }),
    ).toBeInTheDocument();
    // The reveal cover is present until tapped.
    const reveal = screen.getByRole("button", { name: "Show where you stand" });
    fireEvent.click(reveal);
    // Once revealed, the requirement detail and the retest timing are shown.
    expect(
      screen.getByText("You're up to date. Next test in 40 days."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Show where you stand" }),
    ).toBeNull();
  });

  it("routes to testing when Find testing is tapped", () => {
    const onFindTesting = vi.fn();
    render(
      <StandingCard
        standing={blue}
        daysLeft={40}
        tested
        onFindTesting={onFindTesting}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Find testing" }));
    expect(onFindTesting).toHaveBeenCalledOnce();
  });

  it("tells a lapsed owner their last test is too old", () => {
    render(
      <StandingCard
        standing={{
          recentPanel: false,
          clear: true,
          route: true,
          willBeBlue: false,
        }}
        daysLeft={0}
        tested
        onFindTesting={() => undefined}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Show where you stand" }),
    );
    expect(
      screen.getByText(/Your last test is too old now/),
    ).toBeInTheDocument();
  });
});

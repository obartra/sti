import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CriteriaView } from "./Home.standing.tsx";

const blue = {
  recentPanel: true,
  clear: true,
  route: true,
  willBeBlue: true,
} as const;

describe("CriteriaView (the home 'your criteria' view)", () => {
  it("shows the requirement detail and the retest timing", () => {
    render(
      <CriteriaView
        standing={blue}
        daysLeft={40}
        tested
        onFindTesting={() => undefined}
      />,
    );
    expect(
      screen.getByText("You're up to date. Next test in 40 days."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Find testing" }),
    ).toBeInTheDocument();
  });

  it("routes to testing when Find testing is tapped", () => {
    const onFindTesting = vi.fn();
    render(
      <CriteriaView
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
      <CriteriaView
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
    expect(
      screen.getByText(/Your last test is too old now/),
    ).toBeInTheDocument();
  });
});

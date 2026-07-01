import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { StandingLine, NextTestCard, BlueChecklist } from "./Home.standing.tsx";

const blue = {
  recentPanel: true,
  clear: true,
  route: true,
  willBeBlue: true,
} as const;

describe("StandingLine", () => {
  it("untested reads as not set up, never green", () => {
    render(<StandingLine standing="untested" />);
    expect(screen.getByText("Not set up yet")).toBeInTheDocument();
  });

  it("blue reads as up to date", () => {
    render(<StandingLine standing="blue" />);
    expect(screen.getByText("Up to date")).toBeInTheDocument();
  });

  it("lapsed reads as time to re-test", () => {
    render(<StandingLine standing="lapsed" />);
    expect(screen.getByText("Time to re-test")).toBeInTheDocument();
  });
});

describe("NextTestCard", () => {
  it("shows the due date and days left, and finds testing", () => {
    const onFindTesting = vi.fn();
    render(
      <NextTestCard
        next={{ label: "Due 5 Sep 2026 · in 40 days", overdue: false }}
        onFindTesting={onFindTesting}
      />,
    );
    expect(screen.getByText("Due 5 Sep 2026 · in 40 days")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Find testing" }));
    expect(onFindTesting).toHaveBeenCalledOnce();
  });
});

describe("BlueChecklist", () => {
  it("a met requirement shows no action; an unmet one carries its action", () => {
    const onReport = vi.fn();
    render(
      <BlueChecklist
        standing={{ ...blue, recentPanel: false }}
        actions={{
          onReport,
          onFindTesting: undefined,
          onPrevention: undefined,
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Add a result" }));
    expect(onReport).toHaveBeenCalledOnce();
    // The met rows expose no action buttons.
    expect(screen.queryByRole("button", { name: "Update care" })).toBeNull();
  });
});

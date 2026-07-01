import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Home } from "./Home.tsx";

const untested = {
  recentPanel: false,
  clear: false,
  route: false,
  willBeBlue: false,
} as const;

describe("Home dashboard (standing line)", () => {
  it("a never-tested owner reads as 'Not set up yet', not clear/green", () => {
    render(
      <Home
        badge="gray"
        viewerBadge="gray"
        labels={[]}
        handle="robin"
        standing={untested}
        tested={false}
        daysLeft={0}
      />,
    );
    expect(screen.getByText("Not set up yet")).toBeInTheDocument();
    expect(screen.queryByText("Up to date")).not.toBeInTheDocument();
    // The next-test line invites the first test.
    expect(screen.getByText("Take your first test")).toBeInTheDocument();
  });

  it("a blue owner reads as up to date and shares their passport", () => {
    render(
      <Home badge="blue" viewerBadge="blue" labels={["hiv"]} handle="robin" />,
    );
    expect(screen.getByText("Up to date")).toBeInTheDocument();
    // The honest mirror states the viewer route.
    expect(
      screen.getAllByText("Tested & on HIV prevention").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: /Share my passport/ }),
    ).toBeInTheDocument();
  });

  it("a lapsed owner reads 'Time to re-test' and is overdue", () => {
    render(
      <Home
        badge="gray"
        viewerBadge="gray"
        labels={[]}
        handle="robin"
        standing={{ ...untested, clear: true, route: true }}
        tested
        daysLeft={0}
      />,
    );
    expect(screen.getByText("Time to re-test")).toBeInTheDocument();
    expect(screen.getByText("Overdue, test now")).toBeInTheDocument();
  });

  it("wires the checklist actions and the mirror preview", () => {
    const onReport = vi.fn();
    const onViewAs = vi.fn();
    render(
      <Home
        badge="gray"
        viewerBadge="gray"
        labels={[]}
        handle="robin"
        standing={untested}
        tested={false}
        daysLeft={0}
        onReport={onReport}
        onViewAs={onViewAs}
      />,
    );
    // The unmet "recent test" row carries an "Add a result" action.
    const [addResult] = screen.getAllByRole("button", { name: "Add a result" });
    if (!addResult) throw new Error("no add-result action");
    fireEvent.click(addResult);
    expect(onReport).toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: /See what others see/ }),
    );
    expect(onViewAs).toHaveBeenCalledOnce();
  });

  it("a paused owner sees the pause panel and continues care, no checklist", () => {
    render(
      <Home
        badge="blue"
        viewerBadge="gray"
        labels={["hiv"]}
        handle="robin"
        paused
      />,
    );
    expect(screen.getByText("Your status is paused")).toBeInTheDocument();
    expect(screen.queryByText("For a blue card")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Continue my care/ }),
    ).toBeInTheDocument();
  });
});

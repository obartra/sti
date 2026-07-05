import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { FeelOff } from "./FeelOff.tsx";

// The owner-only "something feel off?" surface: pause (or confirm a pause), a link
// to the non-diagnostic guide, and the testing + PEP finders. It must never name a
// condition, and a pause offers resume only when it is a manual one.
describe("FeelOff", () => {
  it("offers a one-tap pause when not paused, and fires the finders + guide", () => {
    const onPause = vi.fn();
    const onLearnSymptoms = vi.fn();
    const onFindTesting = vi.fn();
    const onFindPep = vi.fn();
    render(
      <FeelOff
        paused={false}
        onPause={onPause}
        onLearnSymptoms={onLearnSymptoms}
        onFindTesting={onFindTesting}
        onFindPep={onFindPep}
      />,
    );

    screen.getByRole("button", { name: /pause my status/i }).click();
    expect(onPause).toHaveBeenCalledTimes(1);

    screen.getByRole("button", { name: /worth getting checked/i }).click();
    expect(onLearnSymptoms).toHaveBeenCalledTimes(1);
    screen.getByRole("button", { name: /find testing/i }).click();
    expect(onFindTesting).toHaveBeenCalledTimes(1);
    screen.getByRole("button", { name: /PEP/i }).click();
    expect(onFindPep).toHaveBeenCalledTimes(1);

    // No pause CTA should double as a resume, and nothing here names a condition.
    expect(
      screen.queryByRole("button", { name: /resume/i }),
    ).not.toBeInTheDocument();
  });

  it("confirms a manual pause with a resume control", () => {
    const onResume = vi.fn();
    render(<FeelOff paused onResume={onResume} />);
    expect(screen.getByText(/your status is paused/i)).toBeInTheDocument();
    screen.getByRole("button", { name: /resume sharing/i }).click();
    expect(onResume).toHaveBeenCalledTimes(1);
    // Paused: no pause CTA.
    expect(
      screen.queryByRole("button", { name: /pause my status/i }),
    ).not.toBeInTheDocument();
  });

  it("omits resume for an auto-pause (no onResume), showing the recover note", () => {
    render(<FeelOff paused />);
    expect(screen.getByText(/while you recover/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /resume/i }),
    ).not.toBeInTheDocument();
  });
});

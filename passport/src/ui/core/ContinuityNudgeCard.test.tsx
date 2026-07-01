import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ContinuityNudgeCard } from "./ContinuityNudgeCard.tsx";

describe("ContinuityNudgeCard", () => {
  it("renders the phrase rehearsal and dismisses without touching the account", async () => {
    const onDismiss = vi.fn();
    const onGoToSettings = vi.fn();
    render(
      <ContinuityNudgeCard
        kind="phrase"
        onGoToSettings={onGoToSettings}
        onDismiss={onDismiss}
      />,
    );
    expect(
      screen.getByText("Can you still find your recovery phrase?"),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "I've got it" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    // "I've got it" is a plain dismissal: it never navigates.
    expect(onGoToSettings).not.toHaveBeenCalled();
  });

  it("'remind me later' dismisses and never navigates", async () => {
    const onDismiss = vi.fn();
    const onGoToSettings = vi.fn();
    render(
      <ContinuityNudgeCard
        kind="phrase"
        onGoToSettings={onGoToSettings}
        onDismiss={onDismiss}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Remind me later" }),
    );
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onGoToSettings).not.toHaveBeenCalled();
  });

  it("'show me where' opens Settings and dismisses", async () => {
    const onDismiss = vi.fn();
    const onGoToSettings = vi.fn();
    render(
      <ContinuityNudgeCard
        kind="phrase"
        onGoToSettings={onGoToSettings}
        onDismiss={onDismiss}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Show me where" }),
    );
    expect(onGoToSettings).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("renders the yearly password reminder with its own copy and 'change it'", async () => {
    const onDismiss = vi.fn();
    const onGoToSettings = vi.fn();
    render(
      <ContinuityNudgeCard
        kind="password"
        onGoToSettings={onGoToSettings}
        onDismiss={onDismiss}
      />,
    );
    expect(
      screen.getByText("Time to refresh your password?"),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Change it" }));
    expect(onGoToSettings).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

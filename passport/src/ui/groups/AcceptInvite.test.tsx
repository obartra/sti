import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { AcceptInvite } from "./AcceptInvite.tsx";
import type { GroupInvite } from "../../store/index.ts";

function invite(kind: "event" | "recurring"): GroupInvite {
  return {
    groupId: "g1",
    lifecycleInbox: { inboxId: "i", writeToken: "w", key: "k" },
    handle: "thursday_run",
    visibility: "private",
    meetingKind: kind,
  };
}

const noop = {
  onAccept: vi.fn().mockResolvedValue(undefined),
  onReject: vi.fn().mockResolvedValue(undefined),
  onJoined: vi.fn(),
  onClaim: vi.fn(),
  onBack: vi.fn(),
};

describe("AcceptInvite", () => {
  it("shows the event disclosure and joins", async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn().mockResolvedValue(undefined);
    render(
      <AcceptInvite
        {...noop}
        invite={invite("event")}
        isLoggedIn
        onAccept={onAccept}
      />,
    );
    expect(screen.getByText("Join thursday_run?")).toBeInTheDocument();
    // The event line names whoever was there (doc 33), not the recurring wording.
    expect(
      screen.getByText(/If someone at this event tests positive/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Join" }));
    expect(onAccept).toHaveBeenCalledWith(invite("event"));
    // On success the "you're in" state shows.
    expect(await screen.findByText("You're in.")).toBeInTheDocument();
  });

  it("shows the recurring disclosure", () => {
    render(<AcceptInvite {...noop} invite={invite("recurring")} isLoggedIn />);
    expect(
      screen.getByText(/If someone in this group tests positive/),
    ).toBeInTheDocument();
  });

  it("declines the invite", async () => {
    const user = userEvent.setup();
    const onReject = vi.fn().mockResolvedValue(undefined);
    const onBack = vi.fn();
    render(
      <AcceptInvite
        {...noop}
        invite={invite("recurring")}
        isLoggedIn
        onReject={onReject}
        onBack={onBack}
      />,
    );
    await user.click(screen.getByRole("button", { name: "No thanks" }));
    expect(onReject).toHaveBeenCalledWith(invite("recurring"));
    await waitFor(() => expect(onBack).toHaveBeenCalled());
  });

  it("logged out: points to make an account instead of joining", async () => {
    const user = userEvent.setup();
    const onClaim = vi.fn();
    render(
      <AcceptInvite
        {...noop}
        invite={invite("recurring")}
        isLoggedIn={false}
        onClaim={onClaim}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Join" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create an account" }));
    expect(onClaim).toHaveBeenCalled();
  });
});

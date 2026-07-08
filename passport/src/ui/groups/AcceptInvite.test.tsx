import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { AcceptInvite } from "./AcceptInvite.tsx";
import { GroupInviteSpentError, type GroupInvite } from "../../store/index.ts";

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
    // With no name, the face choice is hidden and the default is anonymous.
    expect(screen.queryByText("How you show up")).not.toBeInTheDocument();
    expect(onAccept).toHaveBeenCalledWith(invite("event"), "anonymous");
    // On success the "you're in" state shows.
    expect(await screen.findByText("You're in.")).toBeInTheDocument();
  });

  it("show-as-you: joins as main when the owner picks their name", async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn().mockResolvedValue(undefined);
    render(
      <AcceptInvite
        {...noop}
        invite={invite("recurring")}
        isLoggedIn
        hasName
        onAccept={onAccept}
      />,
    );
    // The choice is offered because the owner has a name.
    expect(screen.getByText("How you show up")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Your name" }));
    await user.click(screen.getByRole("button", { name: "Join" }));
    expect(onAccept).toHaveBeenCalledWith(invite("recurring"), "main");
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

  it("spent link: says it was already used instead of a false you're-in", async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn().mockRejectedValue(new GroupInviteSpentError());
    render(
      <AcceptInvite
        {...noop}
        invite={invite("recurring")}
        isLoggedIn
        onAccept={onAccept}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Join" }));
    expect(
      await screen.findByText("Someone already used this link."),
    ).toBeInTheDocument();
    expect(screen.queryByText("You're in.")).not.toBeInTheDocument();
  });

  it("a plain failure keeps the join screen and shows a retryable error", async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn().mockRejectedValue(new Error("network"));
    render(
      <AcceptInvite
        {...noop}
        invite={invite("recurring")}
        isLoggedIn
        onAccept={onAccept}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Join" }));
    expect(
      await screen.findByText("Couldn't join right now. Try again."),
    ).toBeInTheDocument();
    // Join is still there for a retry.
    expect(screen.getByRole("button", { name: "Join" })).toBeInTheDocument();
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

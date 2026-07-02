import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { GroupRequestsReview } from "./GroupRequestsReview.tsx";
import type { GroupRecord, PendingRequest } from "../../store/index.ts";

const group: GroupRecord = {
  groupId: "g1",
  groupWriteToken: "w",
  kg: "k",
  myCardId: "self",
  myCardWriteToken: "w",
  handle: "thursday_run",
  visibility: "public",
  meetingKind: "recurring",
  isAdmin: true,
};

const req: PendingRequest = { requesterHash: "r1", pubKey: "r1-key" };

describe("GroupRequestsReview", () => {
  it("reviews on open and approves a request, then re-reviews", async () => {
    const user = userEvent.setup();
    const onReview = vi.fn().mockResolvedValue([req]);
    const onApprove = vi.fn().mockResolvedValue(undefined);
    render(
      <GroupRequestsReview
        group={group}
        onReview={onReview}
        onApprove={onApprove}
        onReject={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    expect(onReview).toHaveBeenCalledWith("g1");
    expect(
      await screen.findByText("Someone asked to join."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Let them in" }));
    expect(onApprove).toHaveBeenCalledWith("g1", req);
    // The approve resolves, then the panel re-reviews (a second read).
    await waitFor(() => expect(onReview).toHaveBeenCalledTimes(2));
  });

  it("rejects a request", async () => {
    const user = userEvent.setup();
    const onReject = vi.fn().mockResolvedValue(undefined);
    render(
      <GroupRequestsReview
        group={group}
        onReview={vi.fn().mockResolvedValue([req])}
        onApprove={vi.fn().mockResolvedValue(undefined)}
        onReject={onReject}
      />,
    );
    await screen.findByText("Someone asked to join.");
    await user.click(screen.getByRole("button", { name: "Not now" }));
    expect(onReject).toHaveBeenCalledWith("g1", req);
  });

  it("shows the empty state when no one is waiting", async () => {
    render(
      <GroupRequestsReview
        group={group}
        onReview={vi.fn().mockResolvedValue([])}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(
      await screen.findByText("No one is waiting to join right now."),
    ).toBeInTheDocument();
  });
});

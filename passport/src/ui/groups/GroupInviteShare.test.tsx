import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { GroupInviteShare } from "./GroupInviteShare.tsx";
import type { GroupRecord } from "../../store/index.ts";

function group(extra: Partial<GroupRecord> = {}): GroupRecord {
  return {
    groupId: "g1",
    groupWriteToken: "w",
    kg: "k",
    myCardId: "self",
    myCardWriteToken: "w",
    handle: "thursday_run",
    visibility: "public",
    meetingKind: "recurring",
    isAdmin: true,
    ...extra,
  };
}

describe("GroupInviteShare", () => {
  it("creates an invite link and shows it in the share card", async () => {
    const user = userEvent.setup();
    const onCreateInvite = vi
      .fn()
      .mockResolvedValue("https://sti.care/g#g=ZGVtbw");
    render(
      <GroupInviteShare
        group={group()}
        onCreateInvite={onCreateInvite}
        onRevokeInvite={vi.fn()}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "Create an invite link" }),
    );
    expect(onCreateInvite).toHaveBeenCalledWith("g1");
    // The link (scheme stripped) shows in the reused URL card, with a copy action.
    expect(await screen.findByText(/sti\.care\/g#g=/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copy link" }),
    ).toBeInTheDocument();
  });

  it("lists a pending invite and cancels it", async () => {
    const user = userEvent.setup();
    const onRevokeInvite = vi.fn();
    render(
      <GroupInviteShare
        group={group({
          pendingInvites: [
            {
              inviteId: "inv1",
              lifecycleInbox: { inboxId: "i", writeToken: "w", key: "k" },
              createdDay: 20000,
              label: "Sam",
            },
          ],
        })}
        onCreateInvite={vi.fn()}
        onRevokeInvite={onRevokeInvite}
      />,
    );
    expect(screen.getByText("Sam")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel invite" }));
    expect(onRevokeInvite).toHaveBeenCalledWith("g1", "inv1");
  });
});

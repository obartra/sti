import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { GroupsList } from "./GroupsList.tsx";
import { GROUP_JOIN_WAIT_DAYS } from "../../store/index.ts";
import { todayEpochDay } from "../../core/clock.ts";
import type {
  GroupMemberSecret,
  GroupRecord,
} from "../../store/accountBlob.ts";

function member(id: string): GroupMemberSecret {
  return {
    cardId: id,
    memberKey: "k",
    lifecycleInbox: { inboxId: "i", writeToken: "w", key: "k" },
  };
}

function group(extra: Partial<GroupRecord>): GroupRecord {
  return {
    groupId: "g1",
    groupWriteToken: "w",
    kg: "k",
    myCardId: "self-card",
    myCardWriteToken: "w",
    handle: "thursday_run",
    visibility: "public",
    meetingKind: "recurring",
    isAdmin: true,
    ...extra,
  };
}

describe("GroupsList", () => {
  it("empty: shows the empty state and fires create", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    render(<GroupsList groups={[]} onCreate={onCreate} />);
    expect(screen.getByText(/No groups yet/)).toBeInTheDocument();
    // Two "Create a group" buttons (header + empty state); either works.
    const [createBtn] = screen.getAllByRole("button", {
      name: "Create a group",
    });
    if (!createBtn) throw new Error("no create action");
    await user.click(createBtn);
    expect(onCreate).toHaveBeenCalled();
  });

  it("populated: renders a row per group with a human member count", async () => {
    const user = userEvent.setup();
    const onOpenGroup = vi.fn();
    const groups = [
      group({ members: [member("a"), member("b")] }), // 2 + self = 3 people
      group({ groupId: "g2", handle: "fern_house", visibility: "private" }), // just you
    ];
    render(<GroupsList groups={groups} onOpenGroup={onOpenGroup} />);

    expect(screen.getByText("thursday_run")).toBeInTheDocument();
    expect(screen.getByText("3 people")).toBeInTheDocument();
    expect(screen.getByText("fern_house")).toBeInTheDocument();
    expect(screen.getByText("Just you")).toBeInTheDocument();
    // The visibility chip distinguishes the two groups.
    expect(screen.getByText("Invite only")).toBeInTheDocument();

    await user.click(screen.getByText("thursday_run"));
    expect(onOpenGroup).toHaveBeenCalledWith("g1");
  });

  it("a join that never opened reads 'Still waiting', not an untrue count", () => {
    const today = todayEpochDay();
    // Member-side records exactly as accept leaves them: no admin write token and
    // no `kg` (the fields are omitted). One is past the wait window (stalled), one
    // is fresh and still shows the count.
    const memberGroup = (
      groupId: string,
      handle: string,
      joinedDay: number,
    ): GroupRecord => ({
      groupId,
      myCardId: `${groupId}-card`,
      myCardWriteToken: "w",
      handle,
      visibility: "public",
      meetingKind: "recurring",
      isAdmin: false,
      joinedDay,
    });
    const groups = [
      memberGroup("g1", "thursday_run", today - GROUP_JOIN_WAIT_DAYS),
      memberGroup("g2", "fern_house", today),
    ];
    render(<GroupsList groups={groups} />);
    expect(screen.getByText("Still waiting")).toBeInTheDocument();
    expect(screen.getByText("Just you")).toBeInTheDocument();
  });
});

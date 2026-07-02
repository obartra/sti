import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { GroupsList } from "./GroupsList.tsx";
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
});

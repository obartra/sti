import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { GroupDetail } from "./GroupDetail.tsx";
import { GROUP_JOIN_WAIT_DAYS } from "../../store/index.ts";
import { todayEpochDay } from "../../core/clock.ts";
import type { GroupRecord, RosterMemberView } from "../../store/index.ts";

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

// A member-side record exactly as accept leaves it: no admin write token and no
// `kg` yet (the fields are OMITTED, matching the stalled-join shape).
function memberGroup(joinedDay: number): GroupRecord {
  return {
    groupId: "g1",
    myCardId: "self-card",
    myCardWriteToken: "w",
    handle: "thursday_run",
    visibility: "public",
    meetingKind: "recurring",
    isAdmin: false,
    joinedDay,
  };
}

function row(
  cardId: string,
  handle: string | null,
  opts: { isAdmin: boolean; isSelf: boolean },
): RosterMemberView {
  return {
    cardId,
    card: handle === null ? null : { state: "blue", identity: { handle } },
    isAdmin: opts.isAdmin,
    isSelf: opts.isSelf,
  };
}

const roster: RosterMemberView[] = [
  row("self-card", "you", { isAdmin: true, isSelf: true }),
  row("m1", "sam", { isAdmin: false, isSelf: false }),
  row("m2", null, { isAdmin: false, isSelf: false }), // gray/absent
];

describe("GroupDetail", () => {
  it("reads the roster on open and shows blue members plus the gray/absent note", async () => {
    const onReadRoster = vi.fn().mockResolvedValue(roster);
    render(
      <GroupDetail
        group={group({})}
        onReadRoster={onReadRoster}
        onLeave={vi.fn()}
        onDisband={vi.fn()}
      />,
    );
    expect(onReadRoster).toHaveBeenCalledWith("g1");
    expect(await screen.findByText("sam")).toBeInTheDocument();
    // The null-card member renders the honest absent note (a gray dot), never a color.
    expect(
      screen.getByText(/gray dot means they haven't shared/),
    ).toBeInTheDocument();
    // They are still named: someone who joined but whose card has not landed yet is
    // a member with an unknown face, not a bare dot next to a menu.
    expect(screen.getByText("Member")).toBeInTheDocument();
  });

  it("admin: shows disband (not leave), and confirm fires the controller", async () => {
    const user = userEvent.setup();
    const onDisband = vi.fn();
    render(
      <GroupDetail
        group={group({ isAdmin: true })}
        onReadRoster={() => Promise.resolve(roster)}
        onLeave={vi.fn()}
        onDisband={onDisband}
      />,
    );
    await screen.findByText("sam");
    expect(
      screen.queryByRole("button", { name: "Leave group" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Disband group" }));
    await screen.findByText("Disband this group?");
    await user.click(screen.getByRole("button", { name: "Disband" }));
    expect(onDisband).toHaveBeenCalled();
  });

  it("admin: removes a member through the confirm, then re-reads the roster", async () => {
    const user = userEvent.setup();
    const onReadRoster = vi.fn().mockResolvedValue(roster);
    const onRemoveMember = vi.fn().mockResolvedValue(undefined);
    render(
      <GroupDetail
        group={group({ isAdmin: true })}
        onReadRoster={onReadRoster}
        onLeave={vi.fn()}
        onDisband={vi.fn()}
        onRemoveMember={onRemoveMember}
      />,
    );
    await screen.findByText("sam");
    // The reader's own row has no remove control; the member row "sam" does.
    const menus = screen.getAllByRole("button", { name: "Member options" });
    expect(menus).toHaveLength(2); // sam + the gray/absent member (not self)
    const [samMenu] = menus;
    if (samMenu === undefined) throw new Error("expected a member menu");
    await user.click(samMenu);
    await user.click(screen.getByRole("button", { name: "Remove from group" }));
    await screen.findByText("Remove this person?");
    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(onRemoveMember).toHaveBeenCalledWith("g1", "m1");
    // The key rotated, so the roster is re-read after the remove resolves.
    await waitFor(() => expect(onReadRoster).toHaveBeenCalledTimes(2));
  });

  it("member: shows leave (not disband), and confirm fires the controller", async () => {
    const user = userEvent.setup();
    const onLeave = vi.fn();
    render(
      <GroupDetail
        group={group({ isAdmin: false })}
        onReadRoster={() =>
          Promise.resolve([
            row("admin-card", "sam", { isAdmin: true, isSelf: false }),
            row("self-card", "you", { isAdmin: false, isSelf: true }),
          ])
        }
        onLeave={onLeave}
        onDisband={vi.fn()}
      />,
    );
    await screen.findByText("sam");
    expect(
      screen.queryByRole("button", { name: "Disband group" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Leave group" }));
    await screen.findByText("Leave this group?");
    await user.click(screen.getByRole("button", { name: "Leave" }));
    await waitFor(() => expect(onLeave).toHaveBeenCalled());
  });

  it("member: a join that never opened shows the quiet recovery, not an empty roster", async () => {
    const user = userEvent.setup();
    const onLeave = vi.fn();
    render(
      <GroupDetail
        group={memberGroup(todayEpochDay() - GROUP_JOIN_WAIT_DAYS)}
        // A never-opened group can only fail closed to an empty roster.
        onReadRoster={() => Promise.resolve([])}
        onLeave={onLeave}
        onDisband={vi.fn()}
      />,
    );
    expect(
      await screen.findByText(/This group hasn't opened yet/),
    ).toBeInTheDocument();
    // No empty "Who's here", and no leave confirm (nothing was ever shared here).
    expect(screen.queryByText("Who's here")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Leave group" }),
    ).not.toBeInTheDocument();
    // Clearing the dead record is one quiet tap.
    await user.click(
      screen.getByRole("button", { name: "Remove from your list" }),
    );
    expect(onLeave).toHaveBeenCalled();
  });

  it("member: a fresh join inside the wait window shows the roster path, not the recovery", async () => {
    render(
      <GroupDetail
        group={memberGroup(todayEpochDay())}
        onReadRoster={() => Promise.resolve([])}
        onLeave={vi.fn()}
        onDisband={vi.fn()}
      />,
    );
    expect(await screen.findByText("Who's here")).toBeInTheDocument();
    expect(
      screen.queryByText(/This group hasn't opened yet/),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Leave group" }),
    ).toBeInTheDocument();
  });
});

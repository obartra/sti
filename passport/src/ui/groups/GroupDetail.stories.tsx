import type { Meta, StoryObj } from "@storybook/react-vite";
import { GroupDetail } from "./GroupDetail.tsx";
import { GROUP_JOIN_WAIT_DAYS } from "../../store/index.ts";
import { todayEpochDay } from "../../core/clock.ts";
import type { GroupRecord, RosterMemberView } from "../../store/index.ts";

// Group detail (doc 33): the calm roster of everyone's status color, plus the one
// way out. Meaningful states: the admin view (disband) with a mixed roster that
// includes a gray/absent member, the member view (leave), and a member whose join
// never opened (the quiet ask-for-a-new-link recovery).
const meta: Meta<typeof GroupDetail> = {
  title: "Passport/Groups/Detail",
  component: GroupDetail,
};
export default meta;
type Story = StoryObj<typeof GroupDetail>;

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

function row(
  cardId: string,
  handle: string | null,
  opts: { isAdmin: boolean; isSelf: boolean },
): RosterMemberView {
  return {
    cardId,
    card:
      handle === null
        ? null
        : {
            state: "blue",
            labels: ["hiv"],
            route: "hiv",
            identity: { handle },
          },
    isAdmin: opts.isAdmin,
    isSelf: opts.isSelf,
  };
}

// A mixed roster: the reader (self + admin), two blue members, and one gray/absent
// member who has not shared a color here yet.
const roster: RosterMemberView[] = [
  row("self-card", "you", { isAdmin: true, isSelf: true }),
  row("m1", "sam", { isAdmin: false, isSelf: false }),
  row("m2", "ari", { isAdmin: false, isSelf: false }),
  row("m3", null, { isAdmin: false, isSelf: false }),
];

// Admin view: the disband control shows.
export const AdminWithRoster: Story = {
  args: {
    group: group({}),
    onReadRoster: () => Promise.resolve(roster),
    onLeave: () => undefined,
    onDisband: () => undefined,
  },
};

// Member view: a non-admin sees the leave control (not disband). The reader's own
// row is not the admin here.
export const MemberView: Story = {
  args: {
    group: group({ isAdmin: false }),
    onReadRoster: () =>
      Promise.resolve([
        row("admin-card", "sam", { isAdmin: true, isSelf: false }),
        row("self-card", "you", { isAdmin: false, isSelf: true }),
        row("m2", "ari", { isAdmin: false, isSelf: false }),
      ]),
    onLeave: () => undefined,
    onDisband: () => undefined,
  },
};

// A join that never opened (doc 33): past the wait window with no shared key, the
// roster gives way to the quiet recovery (ask for a new link, remove the record).
export const StalledJoin: Story = {
  args: {
    // A member-side record exactly as accept leaves it: no admin write token and
    // no `kg` (the fields are omitted), past the wait window.
    group: {
      groupId: "g1",
      myCardId: "self-card",
      myCardWriteToken: "w",
      handle: "thursday_run",
      visibility: "public",
      meetingKind: "recurring",
      isAdmin: false,
      joinedDay: todayEpochDay() - GROUP_JOIN_WAIT_DAYS,
    },
    onReadRoster: () => Promise.resolve([]),
    onLeave: () => undefined,
    onDisband: () => undefined,
  },
};

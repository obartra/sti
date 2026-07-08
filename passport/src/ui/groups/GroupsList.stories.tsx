import type { Meta, StoryObj } from "@storybook/react-vite";
import { GroupsList } from "./GroupsList.tsx";
import { GROUP_JOIN_WAIT_DAYS } from "../../store/index.ts";
import { todayEpochDay } from "../../core/clock.ts";
import type {
  GroupMemberSecret,
  GroupRecord,
} from "../../store/accountBlob.ts";

// The groups list: one row per shared group (name, event/recurring + public/invite
// chips, member count). Meaningful states: a populated list and the empty state.
const meta: Meta<typeof GroupsList> = {
  title: "Passport/Groups/List",
  component: GroupsList,
};
export default meta;
type Story = StoryObj<typeof GroupsList>;

function member(id: string): GroupMemberSecret {
  return {
    cardId: id,
    memberKey: "k",
    lifecycleInbox: { inboxId: "i", writeToken: "w", key: "k" },
  };
}

function group(
  groupId: string,
  handle: string,
  extra: Partial<GroupRecord>,
): GroupRecord {
  return {
    groupId,
    groupWriteToken: "w",
    kg: "k",
    myCardId: `${groupId}-card`,
    myCardWriteToken: "w",
    handle,
    visibility: "public",
    meetingKind: "recurring",
    isAdmin: true,
    ...extra,
  };
}

const groups: GroupRecord[] = [
  group("g1", "thursday_run", {
    members: [member("a"), member("b"), member("c"), member("d")],
  }),
  group("g2", "fern_house", {
    visibility: "private",
    meetingKind: "event",
    members: [member("a")],
  }),
];

// Default: a couple of groups with their chips and member counts.
export const Populated: Story = { args: { groups } };

// Empty: no groups yet, so the empty-state card with a Create CTA shows.
export const Empty: Story = { args: { groups: [] } };

// A member-side join that never opened (doc 33): the count slot quietly reads
// "Still waiting" instead of an untrue "Just you".
export const StalledJoin: Story = {
  args: {
    groups: [
      group("g1", "thursday_run", {
        members: [member("a"), member("b")],
      }),
      // A member-side record exactly as accept leaves it: no admin write token
      // and no `kg` (the fields are omitted), past the wait window.
      {
        groupId: "g3",
        myCardId: "g3-card",
        myCardWriteToken: "w",
        handle: "sunday_ride",
        visibility: "public",
        meetingKind: "recurring",
        isAdmin: false,
        joinedDay: todayEpochDay() - GROUP_JOIN_WAIT_DAYS,
      },
    ],
  },
};

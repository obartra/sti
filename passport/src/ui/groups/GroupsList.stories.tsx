import type { Meta, StoryObj } from "@storybook/react-vite";
import { GroupsList } from "./GroupsList.tsx";
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

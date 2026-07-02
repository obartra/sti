import type { Meta, StoryObj } from "@storybook/react-vite";
import { GroupRequestsReview } from "./GroupRequestsReview.tsx";
import type { GroupRecord, PendingRequest } from "../../store/index.ts";

// The admin join-request review (doc 33, slice 7b): contentless "someone asked to
// join" rows with let-them-in / not-now, plus the empty state.
const meta: Meta<typeof GroupRequestsReview> = {
  title: "Passport/Groups/RequestsReview",
  component: GroupRequestsReview,
};
export default meta;
type Story = StoryObj<typeof GroupRequestsReview>;

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

function req(hash: string): PendingRequest {
  return { requesterHash: hash, pubKey: `${hash}-key` };
}

const actions = {
  onApprove: () => Promise.resolve(),
  onReject: () => Promise.resolve(),
};

// Two people waiting to join.
export const WithRequests: Story = {
  args: {
    group,
    onReview: () => Promise.resolve([req("r1"), req("r2")]),
    ...actions,
  },
};

// No one waiting.
export const Empty: Story = {
  args: { group, onReview: () => Promise.resolve([]), ...actions },
};

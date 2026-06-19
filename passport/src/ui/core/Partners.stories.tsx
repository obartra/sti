import type { Meta, StoryObj } from "@storybook/react-vite";
import { Partners, PartnersSent } from "./Partners.tsx";

// C5 Partner alert review. When a positive is reported, the owner reviews the
// contentless anonymous heads-up that goes to recent linkups, then commits it
// into a 30-minute draft window. The alert never names a condition, never shows
// a status, and never carries the owner's name. The amber/teal/red tones here
// are pure urgency / caution / danger affordances, not a status model: there is
// no badge in this flow.
const meta: Meta<typeof Partners> = {
  title: "Passport/Core/Partner alert review",
  component: Partners,
};
export default meta;
type Story = StoryObj<typeof Partners>;

// The review list. Recent linkups (since the last clear test) are pre-checked;
// earlier linkups can be added back in. Search, add a handle we missed, or open
// a row's menu to remove someone. With two or more recipients the anonymity
// check reads clear.
export const ReviewList: Story = {};

// A single recipient. The anonymity check softens to a caution: a heads-up to
// just one person is a little easier to trace back, so the user is gently
// nudged to add another (but is never blocked from sending).
export const SingleRecipient: Story = {
  args: {
    recipients: [{ handle: "sam", when: "9 Jun" }],
    earlier: [],
  },
};

// Empty list. The send button disables until at least one recipient is on the
// report; the earlier-linkups section is the way back to a populated list.
export const EmptyList: Story = {
  args: {
    recipients: [],
    earlier: [
      { handle: "alexj", when: "29 May" },
      { handle: "jules", when: "26 May" },
    ],
  },
};

type SentStory = StoryObj<typeof PartnersSent>;

// The draft window after committing. The report is editable and fully
// deletable for 30 minutes: add or remove recipients, delete the whole thing,
// or lock it in now. Click "Lock it in now" to advance to the locked state.
export const DraftWindow: SentStory = {
  render: (args) => <PartnersSent {...args} />,
  args: {
    recipients: [{ handle: "sam" }, { handle: "leo" }, { handle: "ari" }],
  },
};

// The locked confirmation. Reached from the draft window once the report locks.
// By design it shows NOTHING about timing, delivery, or recipients, there is no
// status to track and nothing to undo. (In-story: open DraftWindow and press
// "Lock it in now" to see the transition.)
export const Locked: SentStory = {
  render: (args) => <PartnersSent {...args} />,
  args: { recipients: [{ handle: "sam" }, { handle: "leo" }] },
};

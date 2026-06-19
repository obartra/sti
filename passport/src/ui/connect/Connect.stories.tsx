import type { Meta, StoryObj } from "@storybook/react-vite";
import { Connect } from "./Connect.tsx";

// Connect: linkups + faves, reached only by scan or shared link. No directory,
// no @-search. The "waiting on you" block is the recipient side of a scan; faves
// are a capped (9) on-device display preference; recent linkups paginate via
// "Show more". Nothing on this screen surfaces a clinical badge or status.
const meta: Meta<typeof Connect> = {
  title: "Passport/Connect",
  component: Connect,
};
export default meta;
type Story = StoryObj<typeof Connect>;

// Default: a pending scan, three faves, and a full recent list (paginates).
export const Default: Story = {};

// No pending scans: the "Waiting on you" block is hidden entirely.
export const NoPending: Story = { args: { pending: [] } };

// Empty state: no linkups yet and nothing starred.
export const Empty: Story = {
  args: { pending: [], linkups: [], initialFaves: [] },
};

// No faves: the faves card shows its empty prompt.
export const NoFaves: Story = { args: { initialFaves: [] } };

// Faves full: nine starred. Starring another from a row's menu shows the
// "faves are full" note.
export const FavesFull: Story = {
  args: {
    initialFaves: [
      "sam",
      "alexj",
      "kai_",
      "noor",
      "devs",
      "max_t",
      "riley",
      "jess",
      "robin",
    ],
  },
};

// Short list: fewer than the page size, so no "Show more" control appears.
export const FewLinkups: Story = {
  args: {
    pending: [],
    linkups: [
      { handle: "sam", when: "Today" },
      { handle: "alexj", when: "Yesterday" },
    ],
  },
};

// Multiple pending scans waiting on confirmation.
export const ManyPending: Story = {
  args: {
    pending: [
      { handle: "theo", when: "3h ago" },
      { handle: "noor", when: "1d ago" },
    ],
  },
};

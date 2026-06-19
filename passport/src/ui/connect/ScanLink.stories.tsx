import type { Meta, StoryObj } from "@storybook/react-vite";
import { ScanLink } from "./ScanLink.tsx";

// ScanLink: a scanned code proposes a mutual link. The default state offers the
// send/cancel choice; once sent, the actions collapse to a "waiting on their
// confirm" line. Nothing here surfaces a clinical badge or status.
const meta: Meta<typeof ScanLink> = {
  title: "Passport/Connect/Scan to link",
  component: ScanLink,
};
export default meta;
type Story = StoryObj<typeof ScanLink>;

// Default: the scanned alias, with Send / Not now actions.
export const Default: Story = {};

// Sent: the request is out, waiting on the other person to confirm too.
export const Sent: Story = { args: { sent: true } };

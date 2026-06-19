import type { Meta, StoryObj } from "@storybook/react-vite";
import { Alert } from "./Alert.tsx";

// A3: the anonymous exposure alert, with the on-device PEP variants.
const meta: Meta<typeof Alert> = {
  title: "Passport/Exposure alert",
  component: Alert,
};
export default meta;
type Story = StoryObj<typeof Alert>;

// HIV-negative / uncertain (and the anonymous pull page): full PEP card.
export const Show: Story = { args: { pepVariant: "show" } };

// Recipient is on PrEP: softened PEP backup card.
export const OnPrepSoft: Story = { args: { pepVariant: "soft" } };

// Living with HIV: PEP suppressed to a calm note.
export const Suppressed: Story = { args: { pepVariant: "suppress" } };

// Sender previewing what the recipient will receive.
export const SenderPreview: Story = {
  args: { pepVariant: "show", preview: true },
};

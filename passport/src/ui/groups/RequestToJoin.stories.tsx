import type { Meta, StoryObj } from "@storybook/react-vite";
import { RequestToJoin } from "./RequestToJoin.tsx";

// The request-to-join-by-name section (doc 33, slice 7b): type a public group's name
// and ask; an admin then accepts. The requested / not-found states are reached by
// submitting (the handler resolves each), so both stories start on the form.
const meta: Meta<typeof RequestToJoin> = {
  title: "Passport/Groups/RequestToJoin",
  component: RequestToJoin,
};
export default meta;
type Story = StoryObj<typeof RequestToJoin>;

// Submitting resolves "requested": the confirmation replaces the form.
export const AsksAndConfirms: Story = {
  args: { onRequest: () => Promise.resolve("requested") },
};

// Submitting resolves "not-found": the form shows the uniform not-found line.
export const NotFound: Story = {
  args: { onRequest: () => Promise.resolve("not-found") },
};

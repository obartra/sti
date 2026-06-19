import type { Meta, StoryObj } from "@storybook/react-vite";
import { ShareLink } from "./ShareLink.tsx";

// ShareLink: show or copy this alias's code. A private alias's link carries no
// key and only opens for people you hand it to; a public alias's link carries a
// key fragment and shows status to anyone you send it. Nothing here surfaces a
// clinical badge.
const meta: Meta<typeof ShareLink> = {
  title: "Passport/Connect/Share my link",
  component: ShareLink,
};
export default meta;
type Story = StoryObj<typeof ShareLink>;

// Default: the private/main alias. The URL carries no key fragment.
export const Default: Story = {};

// Public alias: the URL carries a #k=… key and the privacy note changes.
export const PublicAlias: Story = { args: { sharingMode: "public" } };

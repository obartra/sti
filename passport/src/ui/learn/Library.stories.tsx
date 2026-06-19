import type { Meta, StoryObj } from "@storybook/react-vite";
import { Library, Detail } from "./Library.tsx";

// The Learn / STI basics library list and a per-condition article detail.
const meta: Meta = {
  title: "Passport/Learn/Library",
};
export default meta;
type Story = StoryObj;

export const LibraryList: Story = {
  render: () => <Library />,
};

export const ArticleGonorrhea: Story = {
  render: () => <Detail id="gonorrhea" />,
};

export const ArticleHiv: Story = {
  render: () => <Detail id="hiv" />,
};

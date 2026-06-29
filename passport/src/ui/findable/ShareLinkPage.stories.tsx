import type { Meta, StoryObj } from "@storybook/react-vite";
import { ShareLinkPage } from "./ShareLinkPage.tsx";

// The public "share your link" page (docs 16, 17, 23), reachable from the landing
// footer. Uses a sample public name only, never a real status. Phone-width frame
// for the visual baseline.
const meta: Meta<typeof ShareLinkPage> = {
  title: "Passport/Findable/ShareLinkPage",
  component: ShareLinkPage,
  decorators: [
    (Story) => (
      <div style={{ width: 390, padding: 20 }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof ShareLinkPage>;

export const Default: Story = {};

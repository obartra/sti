import type { Meta, StoryObj } from "@storybook/react-vite";
import { ShareLinkGuide } from "./ShareLinkGuide.tsx";

// The share-your-link guide (docs 16, 17): the owner's link + QR, one honest line
// about what a public bio link exposes plus the private-link alternative, and the
// stylized bio placements. Wrapped in a phone-width frame so the visual baseline
// captures the mobile rendering (lostpixel shoots at ~1280px and ignores viewport
// params, so the frame is how a mobile view is pinned).
const meta: Meta<typeof ShareLinkGuide> = {
  title: "Passport/Findable/ShareLinkGuide",
  component: ShareLinkGuide,
  decorators: [
    (Story) => (
      <div style={{ width: 390, padding: 20 }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof ShareLinkGuide>;

// The in-app post-claim moment: the owner's real public name, with the header.
export const InApp: Story = {
  args: { handle: "robin" },
};

// The header-less form the public page embeds (the page supplies its own heading).
export const NoHeader: Story = {
  args: { handle: "sam", showHeader: false },
};

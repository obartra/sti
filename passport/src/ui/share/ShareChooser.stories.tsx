import type { Meta, StoryObj } from "@storybook/react-vite";
import { ShareChooser } from "./ShareChooser.tsx";

// The first step of "Share my passport": pick a private link or a public name
// before any link is minted. Stories render it open inside a relative container so
// the panel is visible for the visual baseline (the mobile bottom-sheet variant
// positions itself against that container; the desktop variant is a fixed overlay).
const meta: Meta<typeof ShareChooser> = {
  title: "Passport/Share chooser",
  component: ShareChooser,
  args: {
    open: true,
    onClose: () => undefined,
    onPrivateLink: () => undefined,
    onPublicName: () => undefined,
  },
  decorators: [
    (Story) => (
      <div style={{ position: "relative", width: 402, height: 720 }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof ShareChooser>;

export const Mobile: Story = {
  args: { desktop: false },
};

export const Desktop: Story = {
  args: { desktop: true },
};

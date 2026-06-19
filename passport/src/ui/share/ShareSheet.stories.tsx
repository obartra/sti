import type { Meta, StoryObj } from "@storybook/react-vite";
import { ShareSheet } from "./ShareSheet.tsx";
import type { ShareSheetProps } from "./ShareSheet.tsx";

// The share modal opened by "Share my passport" and the share-rail buttons.
// Stories render it open inside a relative container so the sheet is visible for
// the visual baseline (the component positions itself against that container for
// the mobile bottom-sheet variant; the desktop variant uses a fixed overlay).
const meta: Meta<typeof ShareSheet> = {
  title: "Passport/Share sheet",
  component: ShareSheet,
  decorators: [
    (Story) => (
      <div style={{ position: "relative", width: 402, height: 720 }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof ShareSheet>;

const base: ShareSheetProps = {
  open: true,
  state: "blue",
  labels: ["hiv", "condoms_always"],
  identity: { handle: "robin" },
};

export const MobilePublic: Story = {
  args: { ...base, sharingMode: "public", desktop: false },
};

export const MobilePrivate: Story = {
  args: { ...base, sharingMode: "link", desktop: false },
};

export const Desktop: Story = {
  args: { ...base, sharingMode: "public", desktop: true },
};

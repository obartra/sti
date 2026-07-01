import type { Meta, StoryObj } from "@storybook/react-vite";
import { ShareSheet } from "./ShareSheet.tsx";
import type { ShareSheetProps } from "./ShareSheet.tsx";
import { DEFAULT_AVATAR } from "../../lib/avatars.ts";

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

// The per-alias identity choice (doc 15). Wiring onIdentityChange surfaces the
// control: anonymous shows the id-derived face, main shows @handle + the
// findability warning.
export const IdentityAnonymous: Story = {
  args: {
    ...base,
    sharingMode: "link",
    desktop: false,
    identityChoice: "anonymous",
    onIdentityChange: () => undefined,
  },
};

export const IdentityMain: Story = {
  args: {
    ...base,
    sharingMode: "link",
    desktop: false,
    identityChoice: "main",
    onIdentityChange: () => undefined,
  },
};

// The per-link face control (doc 15). Wiring the account face + change handler
// surfaces "Face for this link" under the revealed-name choice, so a link can wear
// a different face than the account default.
export const IdentityMainWithFace: Story = {
  args: {
    ...base,
    sharingMode: "link",
    desktop: false,
    identityChoice: "main",
    onIdentityChange: () => undefined,
    avatar: DEFAULT_AVATAR,
    onAvatarOverrideChange: () => undefined,
  },
};

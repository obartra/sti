import type { Meta, StoryObj } from "@storybook/react-vite";
import { Wallet, ApplePass, GooglePass, ShareCard } from "./Wallet.tsx";
import { avatarSrc as avatarSrcFor } from "../../lib/avatars.ts";

const AVATAR = avatarSrcFor(2);

// The "Add to Apple & Google wallet" screen plus the individual pass previews.
// Format is gated by privacy: QR-carrier works for any alias and shows no
// status; the Live status pass is public-only and fails closed to gray.
const meta: Meta<typeof Wallet> = {
  title: "Passport/Wallet",
  component: Wallet,
};
export default meta;
type Story = StoryObj<typeof Wallet>;

// ── The full screen ──────────────────────────────────────────────────────

// Default: a public, blue owner on the QR-carrier format.
export const Screen: Story = {
  args: {
    sharingMode: "public",
    viewerBadge: "blue",
    labels: ["hiv"],
    blueRoute: "hiv",
    walletFormat: "qr",
  },
};

// Public owner who has switched to the Live status pass, fresh read → blue.
export const ScreenLive: Story = {
  args: {
    sharingMode: "public",
    viewerBadge: "blue",
    labels: ["hiv"],
    blueRoute: "hiv",
    walletFormat: "live",
    walletFresh: "fresh",
  },
};

// Live pass that cannot refresh / is stale: fails closed to gray.
export const ScreenLiveStale: Story = {
  args: {
    sharingMode: "public",
    viewerBadge: "blue",
    labels: ["hiv"],
    blueRoute: "hiv",
    walletFormat: "live",
    walletFresh: "stale",
  },
};

// Private alias: the Live option is disabled and explained; only the QR-carrier
// is available.
export const ScreenPrivate: Story = {
  args: {
    sharingMode: "link",
    viewerBadge: "blue",
    labels: ["hiv"],
    blueRoute: "hiv",
    walletFormat: "qr",
  },
};

// ── Apple Wallet pass previews ───────────────────────────────────────────

type AppleStory = StoryObj<typeof ApplePass>;
export const AppleQr: AppleStory = {
  render: (args) => <ApplePass {...args} />,
  args: { format: "qr", handle: "robin", avatarSrc: AVATAR, isPublic: true },
};
export const AppleLiveBlue: AppleStory = {
  render: (args) => <ApplePass {...args} />,
  args: {
    format: "live",
    state: "blue",
    labels: ["hiv"],
    route: "hiv",
    handle: "robin",
    avatarSrc: AVATAR,
    isPublic: true,
  },
};
export const AppleLiveGray: AppleStory = {
  render: (args) => <ApplePass {...args} />,
  args: {
    format: "live",
    state: "gray",
    handle: "robin",
    avatarSrc: AVATAR,
    isPublic: true,
  },
};

// ── Google Wallet pass previews ──────────────────────────────────────────

type GoogleStory = StoryObj<typeof GooglePass>;
export const GoogleQr: GoogleStory = {
  render: (args) => <GooglePass {...args} />,
  args: { format: "qr", handle: "robin", avatarSrc: AVATAR, isPublic: true },
};
export const GoogleLiveBlue: GoogleStory = {
  render: (args) => <GooglePass {...args} />,
  args: {
    format: "live",
    state: "blue",
    labels: ["hiv", "condoms_always"],
    route: "hiv",
    handle: "robin",
    avatarSrc: AVATAR,
    isPublic: true,
  },
};
export const GoogleLiveGray: GoogleStory = {
  render: (args) => <GooglePass {...args} />,
  args: {
    format: "live",
    state: "gray",
    handle: "robin",
    avatarSrc: AVATAR,
    isPublic: true,
  },
};

// ── Standalone shareable card ────────────────────────────────────────────

type ShareStory = StoryObj<typeof ShareCard>;
export const ShareCardQr: ShareStory = {
  render: (args) => <ShareCard {...args} />,
  args: { format: "qr", handle: "robin", avatarSrc: AVATAR, isPublic: true },
};
export const ShareCardSnapshotBlue: ShareStory = {
  render: (args) => <ShareCard {...args} />,
  args: {
    format: "live",
    state: "blue",
    labels: ["hiv"],
    route: "hiv",
    handle: "robin",
    isPublic: true,
    snapshot: true,
  },
};
export const ShareCardSnapshotGray: ShareStory = {
  render: (args) => <ShareCard {...args} />,
  args: {
    format: "live",
    state: "gray",
    handle: "robin",
    isPublic: true,
    snapshot: true,
  },
};

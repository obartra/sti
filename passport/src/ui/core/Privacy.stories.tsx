import type { Meta, StoryObj } from "@storybook/react-vite";
import { Privacy } from "./Privacy.tsx";
import { INITIAL_OWNER_STATE } from "../../core/badge.ts";

// Settings, in three sections: Account (display name, password), Profile (your
// face, card attributes, controls), and the danger zone, with the trust pages
// tucked into an About footer. Public names moved to the Links tab (doc 17).
const meta: Meta<typeof Privacy> = {
  title: "Passport/Core/Settings",
  component: Privacy,
  // A fresh owner; the card-attribute toggles read from and write to this state.
  args: {
    ownerState: INITIAL_OWNER_STATE,
    setOwnerState: () => undefined,
    // The local display name editor (logged-in only in the app).
    name: "robin",
    onSetName: () => undefined,
    onLogOut: () => undefined,
    onViewPromises: () => undefined,
    onViewPrivacyPolicy: () => undefined,
    onViewTerms: () => undefined,
    // Pin the retention-notice reference instant so the "kept until" date is stable
    // in the visual baseline (mid-June 2025 -> kept until June 2027).
    now: 1_750_000_000_000,
  },
};
export default meta;

type Story = StoryObj<typeof Privacy>;

export const Default: Story = {};

// The Profile section with the face row: the account avatar framed under Profile,
// with its entry to the editor.
export const WithFace: Story = {
  args: {
    avatarSrc: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>",
    onEditAvatar: () => undefined,
  },
};

// The password factor (doc 32) wired into Account, with the recovery handle labeled
// as the username you sign in with.
const recoveryOps = {
  set: () => Promise.resolve("set" as const),
  disable: () => Promise.resolve(),
};

export const PasswordOff: Story = {
  args: { recoveryName: null, recoveryOps },
};

export const PasswordOn: Story = {
  args: { recoveryName: "robin", recoveryOps },
};

// The re-view recovery phrase card (doc 32) in Account: stored on this device
// (collapsed behind a confirm gate), and the sign-in fallback when it is not.
const PHRASE = "abcdefghijklmnopqrstuvwxyz0123456789-_ABCDEF";

export const PhraseStored: Story = {
  args: { recoveryPhrase: PHRASE },
};

export const PhraseNotStored: Story = {
  args: { recoveryPhrase: null },
};

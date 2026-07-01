import type { Meta, StoryObj } from "@storybook/react-vite";
import { PublicResolution } from "./PublicResolution.tsx";
import { avatarSrc, randomAvatar, DEFAULT_AVATAR } from "../../lib/avatars.ts";

// A2: the logged-out public resolution surface and its states.
const meta: Meta<typeof PublicResolution> = {
  title: "Passport/Public resolution",
  component: PublicResolution,
};
export default meta;
type Story = StoryObj<typeof PublicResolution>;

// A stranger opened a public link (key in the fragment): the card resolves,
// with the stranger explainer and the claim/verify CTAs.
export const ResolvedForStranger: Story = {
  args: {
    resolved: {
      state: "blue",
      labels: ["hiv", "condoms_always"],
      identity: { handle: "sam" },
    },
  },
};

// A resolved card that carries the owner's chosen avatar (doc 13): the viewer sees
// the look the owner built, not a handle-derived stand-in.
export const ResolvedWithAvatar: Story = {
  args: {
    resolved: {
      state: "blue",
      labels: ["hiv"],
      identity: { handle: "sam" },
      avatarSrc: avatarSrc(randomAvatar(7)),
    },
  },
};

// A logged-in viewer opened a contact invite: "Add to contacts" replaces the knock
// prompt and the claim/verify CTAs (doc 13 path A). The accepter has a name of their
// own, so the Anonymous / Show my name reveal choice appears above the button (doc 15).
export const ContactInviteAccept: Story = {
  args: {
    resolved: {
      state: "blue",
      labels: ["hiv"],
      identity: { handle: "alex" },
    },
    canAccept: true,
    accepterName: "robin",
    accepterAvatar: DEFAULT_AVATAR,
    onAccept: () => Promise.resolve("https://sti.care/a/abc#k=def&n=ghi"),
  },
};

// The same accept surface for an accepter with no name of their own: the reveal
// choice is hidden, so the accept stays anonymous (matches every other share
// surface, doc 15).
export const ContactInviteAcceptNoName: Story = {
  args: {
    resolved: {
      state: "blue",
      labels: ["hiv"],
      identity: { handle: "alex" },
    },
    canAccept: true,
    accepterAvatar: DEFAULT_AVATAR,
    onAccept: () => Promise.resolve("https://sti.care/a/abc#k=def&n=ghi"),
  },
};

// A logged-in viewer opened a RETURN link the person they invited sent back: one
// "Connect" tap completes the two-way link, no paste (doc 13 path A).
export const ReturnLinkConnect: Story = {
  args: {
    resolved: {
      state: "blue",
      labels: ["hiv"],
      identity: { handle: "alex" },
    },
    canConnect: true,
    onConnect: () => undefined,
  },
};

// The owner previewing their own card ("this is what others see"): banner, no CTAs.
export const SelfPreview: Story = {
  args: {
    self: true,
    resolved: { state: "blue", labels: ["hiv"], identity: { handle: "robin" } },
  },
};

// A link-holder hit a private (keyless) alias: uniform gray-nothing + the knock
// affordance + the footnote.
export const LinkHolderKnock: Story = {
  args: {
    linkHolder: true,
    resolved: null,
  },
};

export const LinkHolderKnockSent: Story = {
  args: {
    linkHolder: true,
    initialKnockSent: true,
    resolved: null,
  },
};

// A cold / guessed / anonymous open: uniform gray-nothing, button-free,
// byte-identical to a nonexistent alias.
export const ColdGrayNothing: Story = {
  args: {
    resolved: null,
  },
};

// Arrived via a public findable name (doc 17): same gray-nothing + knock, plus the
// quiet "report this name" affordance under the actions.
export const FindableNameWithReport: Story = {
  args: {
    linkHolder: true,
    resolved: null,
    onReport: () => undefined,
  },
};

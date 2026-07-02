import type { Meta, StoryObj } from "@storybook/react-vite";
import { SelfPreview } from "./SelfPreview.tsx";
import { INITIAL_OWNER_STATE } from "../../core/badge.ts";
import type { AliasRecord } from "../../store/index.ts";

// The per-alias self-preview (doc 15): the owner picks which link to preview and
// sees the exact face it resolves to. Rendered in a phone-width container so the
// picker + resolved card are visible for the visual baseline.
const meta: Meta<typeof SelfPreview> = {
  title: "Passport/Public/Self preview",
  component: SelfPreview,
  args: {
    state: INITIAL_OWNER_STATE,
    accountHandle: "robin",
    onBack: () => undefined,
    onClaim: () => undefined,
    onVerify: () => undefined,
  },
  decorators: [
    (Story) => (
      <div className="spv__story-frame">
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof SelfPreview>;

function alias(over: Partial<AliasRecord>): AliasRecord {
  return { id: "id-0", writeToken: "w", key: "k", isPublic: true, ...over };
}

// No link minted yet: the preview shows the anonymous face a new link would wear.
export const NoLinkYet: Story = {
  args: { aliases: [] },
};

// Two links: the anonymous default and one stamped with the owner's identity.
export const MultipleAliases: Story = {
  args: {
    aliases: [
      alias({ id: "anon-alias-id" }),
      alias({ id: "main-alias-id", handle: "robin" }),
    ],
  },
};

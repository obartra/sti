import type { Meta, StoryObj } from "@storybook/react-vite";
import { avatarFor } from "./avatars.ts";

// DiceBear "Dylan" avatars in the brand teal palette, derived deterministically
// from a handle (doc 19). These samples surface the generator in the visual catalog
// so its output is pinned.
const HANDLES = ["robin", "kai", "sam", "alex", "jess", "morgan"];

function AvatarGallery() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
      {HANDLES.map((handle) => (
        <div
          key={handle}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          <img
            src={avatarFor(handle)}
            alt={`Avatar for @${handle}`}
            width={64}
            height={64}
            style={{ borderRadius: 12, display: "block" }}
          />
          <span
            style={{
              fontSize: 13,
              fontFamily: "var(--font-sans)",
              color: "var(--text-muted)",
            }}
          >
            @{handle}
          </span>
        </div>
      ))}
    </div>
  );
}

const meta: Meta<typeof AvatarGallery> = {
  title: "Design System/Avatars",
  component: AvatarGallery,
};
export default meta;

type Story = StoryObj<typeof AvatarGallery>;

export const Samples: Story = {};

import type { Meta, StoryObj } from "@storybook/react-vite";
import { Matrix } from "./qr.tsx";

// Deterministic faux-QR matrices, seeded by an opaque alias. These samples
// surface the renderer in the visual catalog so its output stays pinned.
function MatrixGallery() {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 24,
        alignItems: "flex-start",
      }}
    >
      <Matrix seed="alias-1" size={160} color="var(--ink-900)" />
      <Matrix seed="alias-2" size={160} hole={9} color="var(--ink-900)" />
      <Matrix
        seed="alias-3"
        size={200}
        color="#2F9BB3"
        bg="#ffffff"
        radius={12}
      />
    </div>
  );
}

const meta: Meta<typeof MatrixGallery> = {
  title: "Design System/QR",
  component: MatrixGallery,
};
export default meta;

type Story = StoryObj<typeof MatrixGallery>;

export const Samples: Story = {};

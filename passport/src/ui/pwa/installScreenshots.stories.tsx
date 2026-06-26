import type { Meta, StoryObj } from "@storybook/react-vite";
import { Home } from "../core/Home.tsx";

/**
 * The source of truth for the PWA install-dialog screenshots (doc 22 C/F).
 * `scripts/screenshots/generate.mjs` screenshots these stories into
 * `public/screenshots/`, so what ships in the manifest is always exactly this story,
 * in sync with the real UI. Fixture data only, never a real session (S7): a chosen
 * blue self-view, framed full-bleed at a phone width so the capture reads as a real
 * mobile screen.
 */
const meta: Meta<typeof Home> = {
  title: "PWA/Install screenshots",
  component: Home,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div
        style={{
          minHeight: "100vh",
          background: "#FBF9F4",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div style={{ width: "100%", maxWidth: 412 }}>
          <Story />
        </div>
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof Home>;

// The hero shot: an up-to-date blue passport, on HIV prevention. The one screen that
// shows what the app is for at a glance.
export const MobileHome: Story = {
  args: { badge: "blue", viewerBadge: "blue", labels: ["hiv"] },
};

import type { Preview } from "@storybook/react-vite";
import "../src/styles/storybook.css";
import { StoryMounted } from "./StoryMounted.tsx";

// Every story renders on the real app surface so fidelity matches the comps.
// Responsiveness is breakpoint-driven (no phone chrome), so use the toolbar
// viewport / resize the canvas to check mobile vs desktop.
const preview: Preview = {
  // No global layout: only stories that opt into `layout: fullscreen` (the app
  // shell) skip the centered surface wrapper below.
  decorators: [
    // Component/screen stories render on a padded app surface. Fullscreen
    // stories (the app shell) own their full-viewport layout, so skip the
    // padding wrapper or it fights their 100dvh chrome and clips the tab bar.
    (Story, context) =>
      context.parameters?.["layout"] === "fullscreen" ? (
        <Story />
      ) : (
        <div
          style={{
            minHeight: "100vh",
            background: "var(--surface-app)",
            padding: "var(--space-8)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
          }}
        >
          <Story />
        </div>
      ),
    // Innermost: signals lost-pixel once the story tree (and its images) are on
    // screen, and catches render errors into a deterministic fallback.
    (Story) => (
      <StoryMounted>
        <Story />
      </StoryMounted>
    ),
  ],
};

export default preview;

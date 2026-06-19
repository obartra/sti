import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  framework: { name: "@storybook/react-vite", options: {} },
  // Serve public/ (logo wordmark, assets) at the root so stories render them.
  staticDirs: ["../public"],
};

export default config;

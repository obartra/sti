import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  framework: { name: "@storybook/react-vite", options: {} },
  // Serve public/ (logo wordmark, assets) at the root so stories render them.
  staticDirs: ["../public"],
  // Storybook (@storybook/react-vite) merges the app's vite.config.ts, which pulls
  // in the offline-shell precache plugin and its size budget (doc 22 N). That plugin
  // is for the APP build only: Storybook ships a separate, larger bundle to /design
  // that is not the installable shell, so running the budget against it both pollutes
  // /design with a precache.json and wrongly trips the budget. Strip it here.
  viteFinal(viteConfig) {
    return {
      ...viteConfig,
      plugins: (viteConfig.plugins ?? []).filter(
        (plugin) =>
          !(
            plugin !== null &&
            typeof plugin === "object" &&
            !Array.isArray(plugin) &&
            "name" in plugin &&
            (plugin as { name?: unknown }).name === "precache-manifest"
          ),
      ),
    };
  },
};

export default config;

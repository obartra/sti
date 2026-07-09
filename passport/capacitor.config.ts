import type { CapacitorConfig } from "@capacitor/cli";

// The native shell that wraps the built web app (doc 26). Capacitor copies the
// Vite `dist/` into each native project and loads it locally, so the app launches
// from the bundled build, never a remote URL (doc 26, D1). The whole frontend,
// the hash router, the crypto, the API client, demo mode, runs unchanged inside
// the system WebView; native capability is added later at the edges, behind
// capability detection, with a web fallback.
const config: CapacitorConfig = {
  appId: "care.sti.app",
  appName: "sti.care",
  webDir: "dist",
};

export default config;

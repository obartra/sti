// One blind store + one built preview for the whole Playwright run (doc 38 §4).
// The api base URL is baked into the build (src/config.ts), so the built app and
// its throwaway server pair one to one; booting them once per run and handing the
// origins to every spec through the environment is both faster and simpler than a
// per-spec boot. Specs isolate per ACCOUNT (each mints its own through the real
// sign-up flow), not per server. The returned function is Playwright's global
// teardown: it kills the preview and the store.
import { execFileSync, spawn, type ChildProcess } from "node:child_process";

import {
  startApi,
  freePort,
  type Harness,
} from "../../src/test-support/serverHarness.ts";

async function waitFor(url: string, attempts = 120): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`${url} never came up`);
}

export default async function globalSetup(): Promise<() => void> {
  const previewPort = await freePort();
  const previewOrigin = `http://localhost:${previewPort}`;
  // The server must allowlist the exact browser origin, or every cross-origin
  // api fetch is blocked (doc 11 CORS prerequisite).
  const harness: Harness = await startApi({
    env: { STI_ALLOWED_ORIGINS: previewOrigin },
  });

  // Build + preview the REAL app, pointed at the throwaway server. A preview of a
  // production build is quieter than dev (no HMR), so console assertions are stable.
  // The full `build` (app + service worker), not just `vite build`: the app
  // registers /sw.js on load (doc 22 slice 2), so a partial build would 404 it to
  // the SPA fallback and log a "text/html" registration error the console gates catch.
  // A failed build or a preview that never comes up must still stop what already
  // started, or the store (and preview) outlive the run as orphan processes:
  // Playwright only runs the returned teardown after a SUCCESSFUL setup.
  const env = { ...process.env, VITE_API_BASE_URL: harness.baseUrl };
  let preview: ChildProcess;
  try {
    execFileSync("npm", ["run", "build"], { env, stdio: "inherit" });
    // Spawn the vite bin itself (its shebang execs node in place), NOT `npx vite`:
    // killing an npx wrapper leaves the actual server running as an orphan, and
    // those pile up one per run.
    preview = spawn(
      "node_modules/.bin/vite",
      ["preview", "--port", String(previewPort), "--strictPort"],
      { env, stdio: "ignore" },
    );
  } catch (err) {
    harness.stop();
    throw err;
  }
  try {
    await waitFor(previewOrigin + "/");
  } catch (err) {
    preview.kill("SIGKILL");
    harness.stop();
    throw err;
  }

  process.env.E2E_PREVIEW_ORIGIN = previewOrigin;
  process.env.E2E_API_BASE = harness.baseUrl;
  return () => {
    preview.kill("SIGKILL");
    harness.stop();
  };
}

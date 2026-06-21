// The behavioral plane (doc 13 §2 / §6). It boots a throwaway blind store, seeds
// a real public passport card through the production crypto, builds and previews
// the real app pointed at that server, and drives a browser through the public
// resolution journeys, asserting the rendered state and a clean console. Each
// test is tagged with a catalog behavior id; a meta-test fails if a validated
// browser behavior has no test here. Run with `npm run test:e2e`.
import { test, expect, type Page } from "@playwright/test";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";

import {
  startApi,
  freePort,
  type Harness,
} from "../src/test-support/serverHarness.ts";
import { createApiClient } from "../src/api/client.ts";
import { publishCard } from "../src/store/publish.ts";
import { bytesToBase64url, randomAliasId } from "../src/crypto/index.ts";
import { readFileSync } from "node:fs";

// Read the catalog as data (cwd is passport/), so this spec needs no JSON
// import-attribute support from Playwright's loader.
const E2E_PIN = "e2e/resolution.pw.spec.ts";
const BEHAVIORS = JSON.parse(
  readFileSync("src/loadlab/behaviors.json", "utf8"),
) as {
  id: string;
  title: string;
  status: string;
  layer: string;
  pin: string;
}[];
function behavior(id: string): { id: string; title: string } {
  const b = BEHAVIORS.find((x) => x.id === id);
  if (b === undefined) throw new Error(`unknown behavior id: ${id}`);
  return b;
}

const HANDLE = "robin";
const BLUE_HEADLINE = "Tested & on HIV prevention";
const GRAY = "No status shared right now";

let harness: Harness | undefined;
let preview: ChildProcess | undefined;
let previewOrigin = "";
let apiBase = "";
let cardPath = ""; // `/a/{id}#k={keyB64}` for the seeded blue card

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

// Seed one blue public card through the REAL publish path (publishCard mints the
// id/token/key, seals the serialized card, and PUTs it), then return its
// shareable path. Using publishCard, not a hand-rolled seal, means the test
// exercises the exact crypto an owner's device would.
async function seedCard(): Promise<string> {
  const card = {
    state: "blue",
    labels: ["hiv"],
    route: null,
    identity: { handle: HANDLE },
  };
  const { record } = await publishCard(createApiClient(apiBase), card, {
    isPublic: true,
  });
  return `/a/${record.id}#k=${record.key}`;
}

// Collect uncaught client errors (console errors + page errors) for an assertion.
function watchErrors(page: Page): string[] {
  const errs: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errs.push(`console: ${m.text()}`);
  });
  page.on("pageerror", (e) => errs.push(`pageerror: ${String(e)}`));
  return errs;
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const previewPort = await freePort();
  previewOrigin = `http://localhost:${previewPort}`;
  // The server must allowlist the exact browser origin, or the cross-origin
  // resolution fetch is blocked (doc 11 CORS prerequisite).
  harness = await startApi({
    metrics: true,
    env: { STI_ALLOWED_ORIGINS: previewOrigin },
  });
  apiBase = harness.baseUrl;
  cardPath = await seedCard();

  // Build + preview the REAL app, pointed at the throwaway server. A preview of a
  // production build is quieter than dev (no HMR), so console assertions are stable.
  const env = { ...process.env, VITE_API_BASE_URL: apiBase };
  execFileSync("npx", ["vite", "build"], { env, stdio: "inherit" });
  preview = spawn(
    "npx",
    ["vite", "preview", "--port", String(previewPort), "--strictPort"],
    { env, stdio: "ignore" },
  );
  await waitFor(previewOrigin + "/");
});

test.afterAll(() => {
  preview?.kill("SIGKILL");
  harness?.stop();
});

const covered = new Set<string>();
function behaviorTest(
  ids: string | readonly string[],
  fn: (args: { page: Page }) => Promise<void>,
): void {
  const list = typeof ids === "string" ? [ids] : ids;
  for (const id of list) {
    behavior(id); // throws if the id is not in the catalog
    covered.add(id);
  }
  const titles = list.map((id) => behavior(id).title).join(" + ");
  test(`${titles} [${list.join(", ")}]`, fn);
}

behaviorTest(
  ["viewer-resolves-real-card", "client-no-console-errors"],
  async ({ page }) => {
    const errs = watchErrors(page);
    const failed: string[] = [];
    page.on("requestfailed", (r) => {
      const u = r.url();
      // Ignore third-party (fonts/CDN); gate only the app and api origins.
      if (u.startsWith(previewOrigin) || u.startsWith(apiBase)) failed.push(u);
    });
    // Tie the rendered state to a live read of the just-seeded id against THIS
    // throwaway server, so a cached/stale render could not pass.
    const read = page.waitForResponse(
      (r) => r.url().startsWith(`${apiBase}/a/`) && r.status() === 200,
    );
    await page.goto(previewOrigin + cardPath);
    await read;
    await expect(page.getByText(BLUE_HEADLINE)).toBeVisible();
    await expect(page.getByText(`@${HANDLE}`, { exact: true })).toBeVisible();
    await expect(page.getByText(GRAY)).toHaveCount(0);
    expect(errs).toEqual([]);
    expect(failed).toEqual([]);
  },
);

behaviorTest("viewer-gray-on-miss", async ({ page }) => {
  const decoyKey = bytesToBase64url(crypto.getRandomValues(new Uint8Array(32)));
  await page.goto(`${previewOrigin}/a/${randomAliasId()}#k=${decoyKey}`);
  await expect(page.getByText(GRAY)).toBeVisible();
  await expect(page.getByText(`@${HANDLE}`)).toHaveCount(0);
});

behaviorTest("client-gray-on-unreachable", async ({ page }) => {
  // Abort only the cross-origin api read, never the same-origin SPA page load.
  await page.route(`${apiBase}/a/*`, (route) => route.abort());
  await page.goto(previewOrigin + cardPath);
  await expect(page.getByText(GRAY)).toBeVisible(); // fails closed to gray
});

test("the Playwright suite covers every behavior it pins", () => {
  const ownedHere = BEHAVIORS.filter((b) => b.pin === E2E_PIN);
  for (const b of ownedHere) expect(covered.has(b.id)).toBe(true);
  for (const id of covered) {
    expect(BEHAVIORS.find((b) => b.id === id)?.pin).toBe(E2E_PIN);
  }
});

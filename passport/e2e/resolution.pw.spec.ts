// The behavioral plane (doc 14 §2 / §6). Against the run's shared blind store +
// built preview (support/globalSetup.ts), it seeds a real public passport card
// through the production crypto and drives a browser through the public
// resolution journeys, asserting the rendered state and a clean console. Each
// test is tagged with a catalog behavior id; a meta-test fails if a validated
// browser behavior has no test here. Run with `npm run test:e2e`.
import { test, expect } from "@playwright/test";

import { createApiClient } from "../src/api/client.ts";
import { publishCard } from "../src/store/publish.ts";
import { bytesToBase64url, randomAliasId } from "../src/crypto/index.ts";
import { previewOrigin as origin, apiBase as api } from "./support/env.ts";
import { watchErrors } from "./support/journeys.ts";
import { behaviorHarness } from "./support/catalog.ts";

const { behaviorTest, coverageTest } = behaviorHarness(
  "e2e/resolution.pw.spec.ts",
);

const HANDLE = "robin";
const BLUE_HEADLINE = "Tested & on HIV prevention";
const GRAY = "No status shared right now";

let previewOrigin = "";
let apiBase = "";
let cardPath = ""; // `/a/{id}#k={keyB64}` for the seeded blue card

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
  const { record } = await publishCard(createApiClient(apiBase), () => card, {
    isPublic: true,
  });
  return `/a/${record.id}#k=${record.key}`;
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  previewOrigin = origin();
  apiBase = api();
  cardPath = await seedCard();
});

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

// Not a cataloged status behavior (so it does not go through behaviorTest): the PWA
// offline shell. Proves the headline of doc 22 slices 2 + 4: an installed app opens
// with no network. The worker takes control on the second visit (no skipWaiting), so
// we install, wait for it active, revisit to be controlled, then go offline.
test("the installed shell opens offline (doc 22 slices 2 + 4)", async ({
  page,
}) => {
  const ctx = page.context();
  await page.goto(previewOrigin + "/", { waitUntil: "load" });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.goto(previewOrigin + "/", { waitUntil: "load" });
  await expect(page.locator("#root")).not.toBeEmpty();

  await ctx.setOffline(true);
  await page.reload({ waitUntil: "load" });
  // Served from the precached shell; the app still mounts with no network.
  await expect(page.locator("#root")).not.toBeEmpty();
  await ctx.setOffline(false);
});

// The blind-server cache line as an executable spec (doc 22 sections D + K): the
// worker precaches the data-free shell but NEVER an api.sti.care response, so no
// per-id visit trail and no stale-blue can ever sit in CacheStorage. We open a real
// blue card online (so a cross-origin API read definitely happens and HAS the chance
// to be cached), wait for the worker, then enumerate every entry in every Cache the
// worker owns and assert the shell IS cached but no api.sti.care URL ever is. This
// asserts the invariant at its root (the fetch handler excludes the API origin, so
// nothing from it is ever stored), which is stronger and steadier than driving the
// offline UI: you cannot serve from a cache what was never written to one.
test("the worker never writes an api.sti.care response into CacheStorage (doc 22 D/K)", async ({
  page,
}) => {
  await page.goto(previewOrigin + cardPath, { waitUntil: "load" });
  await expect(page.getByText(BLUE_HEADLINE)).toBeVisible(); // online: real API read
  await page.evaluate(() => navigator.serviceWorker.ready);

  const cachedUrls = await page.evaluate(async () => {
    const names = await caches.keys();
    const urls: string[] = [];
    for (const name of names) {
      const cache = await caches.open(name);
      for (const req of await cache.keys()) urls.push(req.url);
    }
    return urls;
  });

  // The shell is cached (offline-capable), and nothing from the API origin is.
  expect(cachedUrls.length).toBeGreaterThan(0);
  expect(cachedUrls.filter((url) => url.startsWith(apiBase))).toEqual([]);
});

// Chrome's own manifest parse as an executable installability spec (doc 22 C/K).
// Lighthouse dropped its PWA/installability audits (v12), so we ask the browser we
// already drive, via CDP, for the manifest it resolved from the SERVED app, and
// assert it is a well-formed installable manifest. This catches a regression a static
// manifest test cannot: the manifest not linked, 404ing, or served with the wrong
// type would leave Chrome with no manifest URL or with parse errors.
test("Chrome resolves a valid installable web app manifest (doc 22 C/K)", async ({
  page,
}) => {
  await page.goto(previewOrigin + "/", { waitUntil: "load" });
  const cdp = await page.context().newCDPSession(page);
  const got = (await cdp.send("Page.getAppManifest")) as {
    url?: string;
    errors?: { critical?: boolean }[];
  };

  // Chrome found and linked the manifest, and parsed it with no errors.
  expect(got.url ?? "").toContain("manifest.webmanifest");
  expect(got.errors ?? []).toEqual([]);

  // The parsed manifest carries the installable basics (standalone, 192 + 512 icons).
  const manifest = (await page.evaluate(
    async (url) => {
      const res = await fetch(url);
      return res.ok ? ((await res.json()) as unknown) : null;
    },
    got.url ?? previewOrigin + "/manifest.webmanifest",
  )) as {
    name?: string;
    display?: string;
    start_url?: string;
    icons?: { sizes?: string }[];
  } | null;
  expect(manifest).not.toBeNull();
  expect(manifest?.name).toBeTruthy();
  expect(manifest?.display).toBe("standalone");
  expect(manifest?.start_url).toBeTruthy();
  const sizes = (manifest?.icons ?? []).map((icon) => icon.sizes);
  expect(sizes).toContain("192x192");
  expect(sizes).toContain("512x512");
});

coverageTest();

// The account journeys, driven headlessly against the real WebAuthn path (doc 38):
// sign up to a working home, come back and unlock with the passkey alone, and sign
// in on a fresh browser with nothing but the phrase. The virtual authenticator
// (support/webauthn.ts) answers the production navigator.credentials calls; the
// app has no test mode.
import { test, expect, type BrowserContext, type Page } from "@playwright/test";

import { previewOrigin } from "./support/env.ts";
import { attachVirtualAuthenticator } from "./support/webauthn.ts";
import { signUp, expectHome, watchErrors } from "./support/journeys.ts";
import { behaviorHarness } from "./support/catalog.ts";

const { behaviorTest, coverageTest } = behaviorHarness("e2e/auth.pw.spec.ts");

test.describe.configure({ mode: "serial" });

// One device across the first two tests: sign-up enrolls the passkey there, and
// the return visit unlocks with it. The phrase crosses to a fresh context (a "new
// device" with no authenticator) for the recovery login.
let device: BrowserContext | undefined;
let devicePage: Page | undefined;
let deviceErrors: string[] = [];
let phrase = "";

test.afterAll(async () => {
  await device?.close();
});

behaviorTest("signup-completes-to-home", async ({ browser }) => {
  device = await browser.newContext();
  devicePage = await device.newPage();
  deviceErrors = watchErrors(devicePage);
  await attachVirtualAuthenticator(devicePage);
  // Keep-signed-in OFF on purpose: the next test's return visit must need a real
  // login rather than silently resuming from the persisted root (doc 24).
  ({ phrase } = await signUp(devicePage, previewOrigin(), {
    name: "Robin",
    keepSignedIn: false,
  }));
  expect(deviceErrors).toEqual([]);
});

behaviorTest("passkey-login-round-trip", async () => {
  const page = devicePage;
  if (page === undefined) throw new Error("sign-up test did not run");
  // A return visit: with keep-signed-in off there is nothing to resume, so the
  // owner lands logged out and unlocks with the passkey alone. This runs the full
  // PRF round-trip (get + eval) against the enrolled virtual credential.
  await page.reload();
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.getByRole("button", { name: "Log in with a passkey" }).click();
  await expectHome(page);
  expect(deviceErrors).toEqual([]);
});

behaviorTest("phrase-login-new-device", async ({ page }) => {
  // A fresh context with NO authenticator: the phrase alone must sign in.
  const errs = watchErrors(page);
  await page.goto(previewOrigin() + "/login");
  await page.getByRole("button", { name: "Other ways to log in" }).click();
  await page.getByRole("button", { name: /Recovery phrase/ }).click();
  await page.getByLabel("Recovery phrase").fill(phrase);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expectHome(page);
  expect(errs).toEqual([]);
});

coverageTest();

// One session used like a person (doc 38 §6): sign up, add a result and watch the
// card change, mint a link, view it logged out, and open the scanner where no
// camera exists. Every visited screen is swept for nonsense a person would trip
// over: placeholder artifacts, dead ends, impossible states.
import { test, expect, type Page } from "@playwright/test";

import { previewOrigin } from "./support/env.ts";
import { attachVirtualAuthenticator } from "./support/webauthn.ts";
import { signUp, expectHome, watchErrors } from "./support/journeys.ts";
import { behaviorHarness } from "./support/catalog.ts";

const { behaviorTest, coverageTest } = behaviorHarness("e2e/smoke.pw.spec.ts");

test.describe.configure({ mode: "serial" });

// Raw placeholder artifacts no rendered screen may ever show a person.
const NONSENSE = /\bundefined\b|\bNaN\b|\[object Object\]|\{\{|null,/;

async function sweepNonsense(page: Page): Promise<void> {
  const body = (await page.locator("body").innerText()).trim();
  expect(body.length).toBeGreaterThan(0); // a blank screen is nonsense too
  expect(body).not.toMatch(NONSENSE);
}

let owner: Page | undefined;
let errors: string[] = [];
let shareUrl = ""; // the contact link minted mid-walk, viewed logged out later

test.afterAll(async () => {
  await owner?.context().close();
});

behaviorTest("report-updates-home", async ({ browser }) => {
  owner = await (await browser.newContext()).newPage();
  errors = watchErrors(owner);
  await attachVirtualAuthenticator(owner);
  await signUp(owner, previewOrigin(), { name: "Sam" });
  await sweepNonsense(owner);

  // Add a full clean core panel + a route, the way the form asks for it.
  await owner.getByRole("button", { name: "Add a result" }).first().click();
  await sweepNonsense(owner);
  const inf = (name: string) => owner!.locator(".rp__inf", { hasText: name });
  await inf("HIV").getByRole("button", { name: "Negative" }).click();
  await inf("Syphilis").getByRole("button", { name: "Negative" }).click();
  for (const name of ["Chlamydia", "Gonorrhoea"]) {
    const site = (label: string) =>
      inf(name).locator(".rp__site", { hasText: label });
    await site("Genital / urine")
      .getByRole("button", { name: "Negative" })
      .click();
    await site("Throat")
      .getByRole("button", { name: "Not a site I use" })
      .click();
    await site("Rectal")
      .getByRole("button", { name: "Not a site I use" })
      .click();
  }
  // The route switch carries no label association (the text is a sibling), so
  // tap the switch control in the row that names it.
  await owner
    .locator(".rp__toggle-row", { hasText: "I’m on PrEP" })
    .locator(".sti-switch")
    .click();
  // The form itself must agree this is a blue card before we trust the save.
  await expect(owner.getByText("This will show a blue card.")).toBeVisible();
  await owner.getByRole("button", { name: "Save results" }).click();
  await expectHome(owner);
  await sweepNonsense(owner);
  expect(errors).toEqual([]);
});

behaviorTest("owner-minted-link-resolves", async ({ page }) => {
  const o = owner;
  if (o === undefined) throw new Error("sign-up test did not run");

  // Mint a link for one person from the Links tab.
  await o.goto(previewOrigin() + "/links");
  await sweepNonsense(o);
  await o.getByPlaceholder("Who is this for?").fill("Alex");
  await o.getByRole("button", { name: "Create a link" }).click();
  const shown = await o.locator(".cl__created-url").textContent();
  shareUrl = "https://" + (shown ?? "").trim();
  expect(shareUrl).toContain("/a/");

  // A logged-out viewer (the fresh default context) opens it and sees the blue
  // status just reported, never the gray fallback and never an account wall.
  const u = new URL(shareUrl);
  const viewerErrors = watchErrors(page);
  await page.goto(previewOrigin() + u.pathname + u.hash);
  await expect(page.getByText(/Tested/).first()).toBeVisible();
  await expect(page.getByText("No status shared right now")).toHaveCount(0);
  await sweepNonsense(page);
  expect(viewerErrors).toEqual([]);
});

behaviorTest("scan-degrades-honestly", async () => {
  const o = owner;
  if (o === undefined) throw new Error("sign-up test did not run");

  // This browser has no camera at all, so the scan screen must land on one of
  // its honest fallbacks (never a dead viewfinder) and Close must walk back out.
  await o.goto(previewOrigin() + "/people");
  await sweepNonsense(o);
  await o.getByText("Connect in person").first().click();
  await expect(
    o.getByText(
      /Camera access is off|We couldn't find a camera|This device can't open the camera/,
    ),
  ).toBeVisible();
  // The show half stays useful without a camera (your code still renders for
  // the other person to scan); Close walks back out to People.
  await o.getByRole("button", { name: "Close", exact: true }).last().click();
  await expect(o.getByText("Show your code and scan theirs")).toBeVisible();
  await sweepNonsense(o);
  expect(errors).toEqual([]);
});

coverageTest();

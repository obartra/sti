// The partner-notify loop at the user level (doc 13): two people link through
// the real remote handshake, one reports a positive, and the other's device
// quietly suggests getting tested, never saying who or what. Then the revoke
// story from the viewer's chair: a revoked contact link reads like nothing,
// not like something broken.
import { test, expect, type Page } from "@playwright/test";

import { previewOrigin, apiBase } from "./support/env.ts";
import { attachVirtualAuthenticator } from "./support/webauthn.ts";
import { signUp, watchErrors } from "./support/journeys.ts";
import { behaviorHarness } from "./support/catalog.ts";

const { behaviorTest, coverageTest } = behaviorHarness("e2e/notify.pw.spec.ts");

test.describe.configure({ mode: "serial" });

const NUDGE = "A recent contact suggests getting tested";
const GRAY = "No status shared right now";

// Minted links carry the canonical share host; open them on the preview origin.
function onPreview(url: string): string {
  const u = new URL(url);
  return previewOrigin() + u.pathname + u.hash;
}

let origin = "";
let pageA: Page | undefined; // reports the positive
let pageB: Page | undefined; // holds A's link and gets the quiet nudge
let errors: string[] = [];
let inviteUrl = ""; // the link A handed B: B's standing read on A

test.beforeAll(() => {
  origin = previewOrigin();
});

test.afterAll(async () => {
  await pageA?.context().close();
  await pageB?.context().close();
});

behaviorTest(
  ["positive-report-nudges-partner", "partner-nudge-contentless"],
  async ({ browser }) => {
    // Two real accounts link through the remote handshake: A mints a link, B
    // accepts it, A opens the return link and connects.
    pageA = await (await browser.newContext()).newPage();
    watchErrors(pageA, errors);
    await attachVirtualAuthenticator(pageA);
    await signUp(pageA, origin, { name: "Alex" });
    pageB = await (await browser.newContext()).newPage();
    watchErrors(pageB, errors);
    await attachVirtualAuthenticator(pageB);
    await signUp(pageB, origin, { name: "Blair" });

    await pageA.goto(origin + "/links");
    await pageA.getByPlaceholder("Who is this for?").fill("Blair");
    await pageA.getByRole("button", { name: "Create a link" }).click();
    const shown = await pageA.locator(".cl__created-url").textContent();
    inviteUrl = "https://" + (shown ?? "").trim();
    expect(inviteUrl).toContain("/a/");

    await pageB.goto(onPreview(inviteUrl));
    await pageB.getByPlaceholder("A private nickname for them").fill("Alex");
    await pageB.getByRole("button", { name: "Add to contacts" }).click();
    await expect(pageB.getByText(/Send this link back/)).toBeVisible();
    const mono = await pageB.locator(".pres__mono").textContent();
    const returnUrl = "https://" + (mono ?? "").trim();

    await pageA.goto(onPreview(returnUrl));
    const ingested = pageA.waitForResponse(
      (r) =>
        r.request().method() === "PUT" &&
        r.url().startsWith(apiBase() + "/acct/"),
    );
    await pageA.getByRole("button", { name: "Connect", exact: true }).click();
    await ingested;

    // A reports a positive the way the form asks. The save itself is the
    // trigger: nothing extra to tap, no "notify?" prompt. Wait for the sealed
    // ping to land in B's inbox before B goes looking.
    await pageA.goto(origin + "/home");
    await pageA.getByRole("button", { name: "Add a result" }).first().click();
    const pinged = pageA.waitForResponse(
      (r) => r.request().method() === "PUT" && r.url().includes("/inbox/"),
    );
    await pageA
      .locator(".rp__inf", { hasText: "Syphilis" })
      .getByRole("button", { name: "Positive" })
      .click();
    await pageA.getByRole("button", { name: "Save results" }).click();
    await expect(pageA.getByText("Result saved")).toBeVisible();
    await pinged;

    // B opens notifications: the quiet row is there, routed toward care, and
    // it is contentless. Nothing on the screen says who: not A's name, and not
    // even B's own private nickname for A.
    await pageB.goto(origin + "/notifications");
    await expect(pageB.getByText(NUDGE)).toBeVisible();
    await expect(
      pageB.getByText("Find testing and PEP options in Care"),
    ).toBeVisible();
    const bodyText = await pageB.locator("body").innerText();
    expect(bodyText).not.toContain("Alex");
    expect(errors).toEqual([]);
  },
);

behaviorTest("revoked-contact-reads-gray", async () => {
  const a = pageA;
  const b = pageB;
  if (a === undefined || b === undefined)
    throw new Error("notify leg did not run");

  // Before the revoke, B's held link still resolves A: the invite screen greets
  // with A's per-link face (the card exists, gray after the positive).
  const before = await b.context().newPage();
  watchErrors(before, errors);
  await before.goto(onPreview(inviteUrl));
  await expect(before.getByText(/Add @\S+ to your contacts/)).toBeVisible();
  await before.close();

  // A revokes the link from the Links tab; the overwrite must land server-side
  // before B looks again.
  await a.goto(origin + "/links");
  const revoked = a.waitForResponse(
    (r) =>
      r.request().method() === "PUT" && r.url().startsWith(apiBase() + "/a/"),
  );
  await a.getByRole("button", { name: "Options for Blair" }).click();
  await a.getByRole("button", { name: "Revoke", exact: true }).click();
  await revoked;

  // B's view of A is now the uniform gray-nothing: no face to add, no badge,
  // and no error distinguishable from a link that never existed.
  const after = await b.context().newPage();
  watchErrors(after, errors);
  await after.goto(onPreview(inviteUrl));
  await expect(after.getByText(GRAY)).toBeVisible();
  await expect(after.getByText(/Add @\S+ to your contacts/)).toHaveCount(0);
  await after.close();
  expect(errors).toEqual([]);
});

coverageTest();

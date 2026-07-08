// The in-person and group connect journeys (doc 38 §6), driven end to end across
// real accounts in separate browsers: one person shows a code, the other scans it
// through Chromium's fake camera playing a QR the app itself minted, and the
// handshake completes the way the product instructs. Then a third joins a group
// through the invite link and all three see the same roster.
import {
  test,
  expect,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";

import { previewOrigin, apiBase } from "./support/env.ts";
import { attachVirtualAuthenticator } from "./support/webauthn.ts";
import { signUp, watchErrors } from "./support/journeys.ts";
import { writeQrVideo } from "./support/qrVideo.ts";
import { launchScannerBrowser, scannerContext } from "./support/fakeCamera.ts";
import { behaviorHarness } from "./support/catalog.ts";

const { behaviorTest, coverageTest } = behaviorHarness(
  "e2e/connect.pw.spec.ts",
);

test.describe.configure({ mode: "serial" });

// Minted links carry the canonical share host; the preview serves the same app on
// its own origin, so open a minted link by its path + fragment there. (The camera
// leg needs no such swap: a scanned code resolves by id + key on any host.)
function onPreview(url: string): string {
  const u = new URL(url);
  return previewOrigin() + u.pathname + u.hash;
}

let origin = "";
let pageA: Page | undefined; // shows the code (default browser)
let scanner: Browser | undefined; // launched with the fake camera
let pageB: Page | undefined; // scans the code
let ctxC: BrowserContext | undefined;
let pageC: Page | undefined; // joins the group via the invite link
let errors: string[] = [];
let returnUrl = ""; // the link B sends back to A

test.beforeAll(() => {
  origin = previewOrigin();
});

test.afterAll(async () => {
  await pageA?.context().close();
  await ctxC?.close();
  await scanner?.close();
});

behaviorTest("scanned-invite-offers-connect", async ({ browser }) => {
  // A signs up and mints a named link; the share QR of that link is what B scans.
  pageA = await (await browser.newContext()).newPage();
  watchErrors(pageA, errors);
  await attachVirtualAuthenticator(pageA);
  await signUp(pageA, origin, { name: "Robin" });
  await pageA.goto(origin + "/links");
  await pageA.getByPlaceholder("Who is this for?").fill("Blair");
  await pageA.getByRole("button", { name: "Create a link" }).click();
  const shown = await pageA.locator(".cl__created-url").textContent();
  const inviteUrl = "https://" + (shown ?? "").trim();
  expect(inviteUrl).toContain("/a/");
  // Until the return link comes back, A's side honestly says so.
  await expect(pageA.getByText("Waiting for their link")).toBeVisible();

  // The camera fixture: render A's invite as the fake camera's feed, then launch
  // B's browser against it (the capture file is a launch-time input, doc 38 §3).
  const video = test.info().outputPath("invite.y4m");
  writeQrVideo(inviteUrl, video);
  scanner = await launchScannerBrowser(video);
  pageB = await (await scannerContext(scanner, origin)).newPage();
  watchErrors(pageB, errors);
  await attachVirtualAuthenticator(pageB);
  await signUp(pageB, origin, { name: "Blair" });

  // B scans: the code must land exactly like opening the link, offering the add.
  await pageB.goto(origin + "/people");
  await pageB.getByText("Scan a code").click();
  await expect(pageB.locator(".pres__knock-title")).toHaveText(
    /Add @\S+ to your contacts/,
  );
  await pageB.getByPlaceholder("A private nickname for them").fill("Robin");
  await pageB.getByRole("button", { name: "Add to contacts" }).click();

  // The product hands B a return link to send back; capture it for the next leg.
  await expect(pageB.getByText(/Send this link back/)).toBeVisible();
  const mono = await pageB.locator(".pres__mono").textContent();
  returnUrl = "https://" + (mono ?? "").trim();
  expect(returnUrl).toContain("/a/");
});

behaviorTest("contact-handshake-links-both-ways", async () => {
  const a = pageA;
  const b = pageB;
  if (a === undefined || b === undefined)
    throw new Error("scan leg did not run");

  // A opens the link B sent back (any messenger would carry it) and connects.
  // The confirmation renders optimistically while the ingest still writes the
  // account blob, so wait for that PUT to land before navigating away (the test
  // moves faster than any person reading the confirmation would).
  await a.goto(onPreview(returnUrl));
  const ingested = a.waitForResponse(
    (r) =>
      r.request().method() === "PUT" &&
      r.url().startsWith(apiBase() + "/acct/"),
  );
  await a.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(
    a.getByText(/Linked\. You and @\S+ can see each other now/),
  ).toBeVisible();
  await ingested;

  // Both rosters agree: the link reads both ways on each device.
  await a.goto(origin + "/links");
  await expect(a.getByText("Linked both ways").first()).toBeVisible();
  await b.goto(origin + "/links");
  await expect(b.getByText("Linked both ways").first()).toBeVisible();
  expect(errors).toEqual([]);
});

behaviorTest("group-invite-links-three", async ({ browser }) => {
  const a = pageA;
  const b = pageB;
  if (a === undefined || b === undefined)
    throw new Error("scan leg did not run");

  // A makes an invite-only group. An invite link is per PERSON (its lifecycle
  // inbox carries one accept, and the admin UI says "send this link to someone
  // you want in"), so A mints one for B and another for C.
  await a.goto(origin + "/groups");
  await a.getByRole("button", { name: "Create a group" }).first().click();
  await a.getByLabel("Group name").fill("saturday_crew");
  await a.getByRole("tab", { name: "Invite only" }).click();
  await a.getByRole("button", { name: "Create a group" }).last().click();
  const linkEl = a.locator(".sh__url-link");
  let lastShown = "";
  const mintInvite = async (): Promise<string> => {
    await a.getByRole("button", { name: "Create an invite link" }).click();
    // Minted asynchronously, and the card may still show the previous invite.
    await expect
      .poll(async () => ((await linkEl.textContent()) ?? "").trim())
      .toMatch(/\/g#g=/);
    await expect
      .poll(async () => ((await linkEl.textContent()) ?? "").trim())
      .not.toBe(lastShown);
    lastShown = ((await linkEl.textContent()) ?? "").trim();
    return "https://" + lastShown;
  };
  const inviteForB = await mintInvite();
  const inviteForC = await mintInvite();
  expect(inviteForC).not.toBe(inviteForB);

  // B joins through their link; so does C, a third fresh account, through theirs.
  await b.goto(onPreview(inviteForB));
  await b.getByRole("button", { name: "Join", exact: true }).click();
  await expect(b.getByText("You're in.")).toBeVisible();

  ctxC = await browser.newContext();
  pageC = await ctxC.newPage();
  watchErrors(pageC, errors);
  await attachVirtualAuthenticator(pageC);
  await signUp(pageC, origin, { name: "Casey" });
  await pageC.goto(onPreview(inviteForC));
  await pageC.getByRole("button", { name: "Join", exact: true }).click();
  await expect(pageC.getByText("You're in.")).toBeVisible();

  // Membership completes through each side opening the group: the admin's visit
  // ingests the accepts and rewrites the group, a member's visit unwraps its key
  // and publishes its card into the roster. Let each visit SETTLE (network idle)
  // so those writes land before the next page moves, and go around until all
  // three rosters agree; people checking their phones do the same, just slower.
  const openGroup = async (page: Page): Promise<void> => {
    await page.goto(origin + "/groups", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /saturday_crew/ }).click();
    await expect(page.getByText("Who's here")).toBeVisible();
    await page.waitForLoadState("networkidle");
  };
  const rosterOfThree = async (page: Page): Promise<boolean> =>
    (await page.locator(".gr__member").count()) === 3;
  for (let round = 0; round < 8; round++) {
    await openGroup(a);
    await openGroup(b);
    await openGroup(pageC);
    if (await rosterOfThree(pageC)) break;
  }
  for (const page of [a, b, pageC]) {
    await openGroup(page);
    await expect(page.locator(".gr__member")).toHaveCount(3);
  }
  expect(errors).toEqual([]);
});

coverageTest();

// The in-person connect journeys (doc 25), driven the way two people standing
// together would: one browser shows the connect screen, another scans it through
// Chromium's fake camera playing the offer QR the app itself rendered, and the
// link completes silently. Then the open door admits a third the same hands-free
// way, and the walk-away rule is held to its word: closing unscanned leaves the
// other side's link uniformly dark.
import { randomBytes } from "node:crypto";

import { test, expect, type Browser, type Page } from "@playwright/test";

import { previewOrigin, apiBase } from "./support/env.ts";
import { attachVirtualAuthenticator } from "./support/webauthn.ts";
import {
  signUp,
  expectHome,
  fillCleanPanel,
  watchErrors,
} from "./support/journeys.ts";
import { writeQrVideo } from "./support/qrVideo.ts";
import { launchScannerBrowser, scannerContext } from "./support/fakeCamera.ts";
import { behaviorHarness } from "./support/catalog.ts";

const { behaviorTest, coverageTest } = behaviorHarness("e2e/linkup.pw.spec.ts");

test.describe.configure({ mode: "serial" });

const CONNECTED = "You're connected.";
const GRAY = "No status shared right now";
const BLUE_HEADLINE = "Tested & on HIV prevention";
// The blue medallion's fill (badge-card.tsx): the completion pair renders one
// teal circle per blue face, so this is how a test sees "the badge shows blue".
const BLUE_DOT = 'circle[fill="var(--teal-500)"]';

let origin = "";
let pageA: Page | undefined; // shows the offer; walks away at the end
let scannerB: Browser | undefined; // launched with A's offer as its camera
let pageB: Page | undefined; // scans A's offer, then holds the open door
let scannerC: Browser | undefined; // launched with B's door as its camera
let pageC: Page | undefined; // scans B's door
let errors: string[] = [];
let offerPath = ""; // A's offer as a bare /a/{id}#k= path (B's read on A)

test.beforeAll(() => {
  origin = previewOrigin();
});

test.afterAll(async () => {
  await pageA?.context().close();
  await scannerB?.close();
  await scannerC?.close();
});

behaviorTest(
  ["linkup-offer-scan-links-silently", "linkup-snapshot-badge-offline"],
  async ({ browser }) => {
    // A signs up, turns blue (so a badge is actually at stake), and opens the
    // connect screen; the offer URL is read off the QR tile exactly as a camera
    // would (the data attribute mirrors the QR's payload).
    pageA = await (await browser.newContext()).newPage();
    watchErrors(pageA, errors);
    await attachVirtualAuthenticator(pageA);
    await signUp(pageA, origin, { name: "Robin" });
    await pageA.getByRole("button", { name: "Add a result" }).first().click();
    await fillCleanPanel(pageA);
    await pageA.getByRole("button", { name: "Save results" }).click();
    await expectHome(pageA);
    await pageA.goto(origin + "/people");
    await pageA.getByText("Connect in person").first().click();
    const tile = pageA.getByTestId("lk-code");
    await expect(tile).toHaveAttribute("data-url", /\/a\//);
    const offerUrl = (await tile.getAttribute("data-url")) ?? "";
    expect(offerUrl).toContain("&b="); // the badge snapshot rides the QR
    // The offer is an ordinary keyed link plus extras in the fragment; the bare
    // link is what B's device effectively holds for A after the gesture.
    const u = new URL(offerUrl);
    const key = new URLSearchParams(u.hash.slice(1)).get("k") ?? "";
    expect(key).not.toBe("");
    offerPath = `${u.pathname}#k=${key}`;

    // B's browser scans that QR. B's alias reads are answered with DECOY bytes
    // (what a miss serves), so the only way B can show A's blue is the snapshot
    // that crossed optically: the doc 25 no-signal moment, not a server read.
    const video = test.info().outputPath("offer.y4m");
    writeQrVideo(offerUrl, video);
    scannerB = await launchScannerBrowser(video);
    pageB = await (await scannerContext(scannerB, origin)).newPage();
    watchErrors(pageB, errors);
    await attachVirtualAuthenticator(pageB);
    await signUp(pageB, origin, { name: "Blair" });
    await pageB.route(apiBase() + "/a/*", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      await route.fulfill({
        status: 200,
        contentType: "application/octet-stream",
        headers: { "access-control-allow-origin": "*" },
        body: randomBytes(4096),
      });
    });
    await pageB.goto(origin + "/people");
    await pageB.getByText("Connect in person").first().click();

    // The scan completes B's side silently: no tap, the completion just lands.
    await expect(pageB.getByText(CONNECTED)).toBeVisible({ timeout: 30_000 });
    // A's face shows the snapshot blue (the live read was a decoy), B's own is
    // gray, and the line stays the neutral one: one gray face, never a verdict.
    await expect(pageB.locator(`.lk__pair ${BLUE_DOT}`)).toHaveCount(1);
    await expect(
      pageB.getByText("Free testing is easy to find when you want it."),
    ).toBeVisible();
    await pageB.unroute(apiBase() + "/a/*");

    // With signal back, the link B now holds resolves A's live card (a second
    // page, so B's completion screen stays open for the door journey).
    const viewer = await pageB.context().newPage();
    watchErrors(viewer, errors);
    await viewer.goto(origin + offerPath);
    await expect(viewer.getByText(BLUE_HEADLINE)).toBeVisible();
    await expect(viewer.getByText(GRAY)).toHaveCount(0);
    await viewer.close();
    expect(errors).toEqual([]);
  },
);

behaviorTest("door-admits-third-hands-free", async () => {
  const b = pageB;
  if (b === undefined) throw new Error("offer leg did not run");

  // B's completion opened its own door; read the door QR the camera way. The
  // door binds asynchronously after the link lands, hence the long attribute wait.
  const door = b.getByTestId("lk-door");
  await expect(door).toHaveAttribute("data-url", /\/d#p=/, {
    timeout: 30_000,
  });
  const doorUrl = (await door.getAttribute("data-url")) ?? "";

  // C arrives and scans the door. The whole leg runs hands-free while B's
  // screen stays open: knock, sealed grant, accept, answer. Nobody points a
  // camera back at C's screen.
  const video = test.info().outputPath("door.y4m");
  writeQrVideo(doorUrl, video);
  scannerC = await launchScannerBrowser(video);
  pageC = await (await scannerContext(scannerC, origin)).newPage();
  watchErrors(pageC, errors);
  await attachVirtualAuthenticator(pageC);
  await signUp(pageC, origin, { name: "Casey" });
  await pageC.goto(origin + "/people");
  await pageC.getByText("Connect in person").first().click();
  await expect(pageC.getByText(CONNECTED)).toBeVisible({ timeout: 60_000 });

  // Both ends of the leg landed: C's completion shows the pair, B's grows to
  // three faces (B, A's, C's) once the answer arrives over the return channel.
  await expect(pageC.locator(".lk__person")).toHaveCount(2);
  await expect(b.locator(".lk__person")).toHaveCount(3, { timeout: 60_000 });

  // Both rosters agree the new link is recorded. B's roster reads "Linked"
  // TWICE: the door leg with C, and the offer leg with A (a scan hands this
  // side everything two-way needs; A walking away later only kills the read,
  // not the record, which is why the row says "Linked" and not "both ways").
  await pageC.goto(origin + "/links");
  await expect(pageC.getByText(/^Linked/).first()).toBeVisible();
  // The Links screen lists every contact twice (the manage list and the "what
  // can resolve" panel), so count within ONE list: exactly the two legs, both
  // linked, nothing pending and nothing extra.
  await b.goto(origin + "/links");
  await expect(
    b
      .locator(".cl__rows")
      .first()
      .getByText(/^Linked/),
  ).toHaveCount(2);
  expect(errors).toEqual([]);
});

behaviorTest("linkup-walkaway-discards-offer", async () => {
  const a = pageA;
  const b = pageB;
  if (a === undefined || b === undefined)
    throw new Error("offer leg did not run");

  // A closes the connect screen having scanned nobody: the gesture never
  // happened on A's side, so the shown offer's alias is revoked on the way out.
  const revoked = a.waitForResponse(
    (r) =>
      r.request().method() === "PUT" && r.url().startsWith(apiBase() + "/a/"),
  );
  await a.getByRole("button", { name: "Close", exact: true }).last().click();
  await expect(a.getByText("Show your code and scan theirs")).toBeVisible();
  await revoked;

  // B's saved link for A now reads the same uniform gray as never-existed: no
  // name, no badge, and nothing that looks like an error to probe.
  const viewer = await b.context().newPage();
  watchErrors(viewer, errors);
  await viewer.goto(origin + offerPath);
  await expect(viewer.getByText(GRAY)).toBeVisible();
  await expect(viewer.getByText(BLUE_HEADLINE)).toHaveCount(0);
  await viewer.close();
  expect(errors).toEqual([]);
});

coverageTest();

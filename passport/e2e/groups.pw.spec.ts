// Group churn at the user level (doc 33): an admin removes a member across
// three real browsers, the key rotates, the survivors' rosters agree, and the
// removed member's view goes quietly empty ("They won't be told why"). Then the
// stalled-join recovery (doc 33 slice 4a): a join whose admin never ingests
// says "Still waiting" after the wait window and can be cleared.
import {
  test,
  expect,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";

import { previewOrigin } from "./support/env.ts";
import { attachVirtualAuthenticator } from "./support/webauthn.ts";
import { signUp, watchErrors } from "./support/journeys.ts";
import { behaviorHarness } from "./support/catalog.ts";

const { behaviorTest, coverageTest } = behaviorHarness("e2e/groups.pw.spec.ts");

test.describe.configure({ mode: "serial" });

// Minted links carry the canonical share host; open them on the preview origin.
function onPreview(url: string): string {
  const u = new URL(url);
  return previewOrigin() + u.pathname + u.hash;
}

let origin = "";
const contexts: BrowserContext[] = [];
let errors: string[] = [];

test.beforeAll(() => {
  origin = previewOrigin();
});

test.afterAll(async () => {
  for (const ctx of contexts) await ctx.close();
});

async function newAccount(browser: Browser, name: string): Promise<Page> {
  const ctx = await browser.newContext();
  contexts.push(ctx);
  const page = await ctx.newPage();
  watchErrors(page, errors);
  await attachVirtualAuthenticator(page);
  await signUp(page, origin, { name });
  return page;
}

// Open a group's detail and let the visit settle: the read is also the write
// (catch-up, key cache, card publish), so the networkidle waits are load-bearing.
async function openGroup(page: Page, name: RegExp): Promise<void> {
  await page.goto(origin + "/groups", { waitUntil: "networkidle" });
  await page.getByRole("button", { name }).click();
  await expect(page.getByText("Who's here")).toBeVisible();
  await page.waitForLoadState("networkidle");
}

// Create an invite-only group and mint one invite link per person to admit.
async function createGroupWithInvites(
  admin: Page,
  groupName: string,
  invitees: number,
): Promise<string[]> {
  await admin.goto(origin + "/groups");
  await admin.getByRole("button", { name: "Create a group" }).first().click();
  await admin.getByLabel("Group name").fill(groupName);
  await admin.getByRole("tab", { name: "Invite only" }).click();
  await admin.getByRole("button", { name: "Create a group" }).last().click();
  const linkEl = admin.locator(".sh__url-link");
  const invites: string[] = [];
  let lastShown = "";
  for (let i = 0; i < invitees; i++) {
    await admin.getByRole("button", { name: "Create an invite link" }).click();
    await expect
      .poll(async () => ((await linkEl.textContent()) ?? "").trim())
      .toMatch(/\/g#g=/);
    await expect
      .poll(async () => ((await linkEl.textContent()) ?? "").trim())
      .not.toBe(lastShown);
    lastShown = ((await linkEl.textContent()) ?? "").trim();
    invites.push("https://" + lastShown);
  }
  return invites;
}

behaviorTest(
  ["member-removal-rotates-key", "removed-member-view-goes-quiet"],
  async ({ browser }) => {
    // Three real accounts converge into one group (the growth path is pinned in
    // connect.pw.spec.ts; here it is the setup for the churn).
    const ana = await newAccount(browser, "Ana");
    const bo = await newAccount(browser, "Bo");
    const cam = await newAccount(browser, "Cam");
    const group = /night_shift/;
    const [forBo, forCam] = await createGroupWithInvites(ana, "night_shift", 2);
    for (const [page, invite] of [
      [bo, forBo],
      [cam, forCam],
    ] as const) {
      await page.goto(onPreview(invite ?? ""));
      await page.getByRole("button", { name: "Join", exact: true }).click();
      await expect(page.getByText("You're in.")).toBeVisible();
    }
    for (let round = 0; round < 8; round++) {
      await openGroup(ana, group);
      await openGroup(bo, group);
      await openGroup(cam, group);
      if ((await cam.locator(".gr__member").count()) === 3) break;
    }
    await expect(cam.locator(".gr__member")).toHaveCount(3);

    // Cam's face in this group is the tagged "you" row on Cam's own screen;
    // that name tells the admin (and the test) which row is Cam's everywhere.
    const camName =
      (await cam
        .locator(".gr__member")
        .filter({
          has: cam.locator(".gr__member-tag", { hasText: /^you$/ }),
        })
        .locator(".gr__member-name")
        .textContent()) ?? "";
    expect(camName).not.toBe("");

    // The admin removes Cam through the row menu and its confirm. The removal
    // rotates the key and re-reads, so the admin's roster settles at two.
    await openGroup(ana, group);
    const row = ana.locator(".gr__member", { hasText: camName });
    await row.getByRole("button", { name: "Member options" }).click();
    await ana.getByRole("button", { name: "Remove from group" }).click();
    await expect(ana.getByText("Remove this person?")).toBeVisible();
    await ana.getByRole("button", { name: "Remove", exact: true }).click();
    await expect(ana.locator(".gr__member")).toHaveCount(2, {
      timeout: 30_000,
    });
    await expect(ana.locator(".gr__member", { hasText: camName })).toHaveCount(
      0,
    );

    // Bo converges to the same two-person roster on the next opens (the read
    // unwraps the rotated key).
    for (let round = 0; round < 8; round++) {
      await openGroup(bo, group);
      if ((await bo.locator(".gr__member").count()) === 2) break;
    }
    await expect(bo.locator(".gr__member")).toHaveCount(2);
    await expect(bo.locator(".gr__member", { hasText: camName })).toHaveCount(
      0,
    );

    // Cam's view goes quietly empty: the group still lists, the detail opens,
    // and there is simply nobody there. No error, no accusation, no why.
    await openGroup(cam, group);
    await expect(cam.locator(".gr__member")).toHaveCount(0);
    const camBody = await cam.locator("body").innerText();
    expect(camBody).not.toMatch(/error|failed|removed|wrong/i);
    expect(errors).toEqual([]);
  },
);

behaviorTest("stalled-join-recoverable", async ({ browser }) => {
  // A dedicated pair: this admin mints an invite and then never opens the app
  // again, so the accept sits in a lifecycle inbox nobody ever reads.
  const dee = await newAccount(browser, "Dee");
  const eli = await newAccount(browser, "Eli");
  const [invite] = await createGroupWithInvites(dee, "quiet_door", 1);
  await eli.goto(onPreview(invite ?? ""));
  await eli.getByRole("button", { name: "Join", exact: true }).click();
  await expect(eli.getByText("You're in.")).toBeVisible();

  // Eight days later on this device (the admin never ingested), the list says
  // so plainly instead of a member count.
  await eli.clock.setFixedTime(Date.now() + 8 * 24 * 60 * 60 * 1000);
  await eli.goto(origin + "/groups", { waitUntil: "networkidle" });
  await expect(eli.getByText("Still waiting")).toBeVisible();

  // The detail replaces the roster with the one honest way out, and clearing
  // removes the ghost from the list (it is a leave, so a late admin ingest
  // cleans itself up).
  await eli.getByRole("button", { name: /quiet_door/ }).click();
  await expect(
    eli.getByText("This group hasn't opened yet. Ask for a new invite link."),
  ).toBeVisible();
  await eli.getByRole("button", { name: "Remove from your list" }).click();
  await expect(eli.getByText("Show your code and scan theirs")).toBeVisible();
  await eli.goto(origin + "/groups");
  await expect(eli.getByRole("button", { name: /quiet_door/ })).toHaveCount(0);
  expect(errors).toEqual([]);
});

coverageTest();

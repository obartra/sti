// Shared user journeys and gates for the logged-in specs (doc 38 §6). Everything
// here drives the app the way a person does: real screens, real buttons, no store
// shortcuts. Selectors prefer the user-visible copy, so a copy change that would
// confuse a person also fails the journey.
import { expect, type Page } from "@playwright/test";

/** Collect uncaught client errors (console errors + page errors) for an
 * assertion. Errors are appended to `sink` as they happen, so pass a shared
 * array to pool several pages into one gate; spreading the return value at
 * attach time would copy an empty snapshot and gate nothing. */
export function watchErrors(page: Page, sink: string[] = []): string[] {
  page.on("console", (m) => {
    if (m.type() === "error") sink.push(`console: ${m.text()}`);
  });
  page.on("pageerror", (e) => sink.push(`pageerror: ${String(e)}`));
  return sink;
}

export interface SignUpOptions {
  /** The private display name typed at b1 (left empty when absent). */
  name?: string;
  /** Turn "Keep me signed in on this device" off at b3 (default: leave it on). */
  keepSignedIn?: boolean;
}

export interface SignedUp {
  /** The genuine recovery phrase shown at b2 (captured for later logins). */
  phrase: string;
}

// Drive the full b1 -> b2 -> b3 sign-up to a working home. The context must have
// a virtual authenticator attached (support/webauthn.ts): b3's best-effort passkey
// enrollment runs the real create() + PRF get() against it.
export async function signUp(
  page: Page,
  origin: string,
  opts: SignUpOptions = {},
): Promise<SignedUp> {
  await page.goto(origin + "/signup");
  if (opts.name !== undefined) {
    await page.getByLabel("What should we call you?").fill(opts.name);
  }
  await page.getByRole("button", { name: "Continue" }).click();

  // b2: the phrase is covered until revealed; reveal, capture, confirm.
  await page.getByRole("button", { name: "Reveal your phrase" }).click();
  const phrase = (await page.locator(".onb__doc").textContent())?.trim() ?? "";
  expect(phrase.length).toBeGreaterThan(0);
  await page.getByRole("button", { name: "I've saved it" }).click();

  // b3: the keep-signed-in choice, then enter (this enrolls the passkey). The
  // switch's real checkbox is visually hidden, so toggle it through its label
  // text (what a person taps) and assert the state actually flipped.
  if (opts.keepSignedIn === false) {
    await page.getByText("Keep me signed in on this device").click();
    await expect(
      page.getByLabel("Keep me signed in on this device"),
    ).not.toBeChecked();
  }
  await page.getByRole("button", { name: "Enter my passport" }).click();
  await expectHome(page);
  return { phrase };
}

/** The signed-in home is up: its two standing actions are on screen (each can
 * render more than once across the responsive chrome, hence first()). */
export async function expectHome(page: Page): Promise<void> {
  await expect(
    page.getByRole("button", { name: "Add a result" }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Share my passport" }).first(),
  ).toBeVisible();
}

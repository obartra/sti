// The passkey fixture (doc 38 §2): a virtual CTAP2 platform authenticator attached
// over CDP, so the app's REAL navigator.credentials calls complete headlessly. No
// app test mode exists; this answers the production WebAuthn path bit for bit.
//
// hasPrf is load-bearing: the auth model wraps the phrase-derived root with the
// passkey's PRF output (auth/keyVault via auth/passkey), and enrollment performs a
// create() followed by a get() that evaluates the PRF salt. Without PRF the app
// correctly fails with "no-prf", which proves only the error path.
import type { Page } from "@playwright/test";

export async function attachVirtualAuthenticator(page: Page): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      hasPrf: true,
      automaticPresenceSimulation: true,
    },
  });
}

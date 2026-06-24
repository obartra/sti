/**
 * Build-time feature flags. A single, greppable place to gate features that are
 * implemented but intentionally not exposed yet.
 *
 * TECH DEBT — WALLET (Apple/Google Wallet passes): the wallet screen + pass
 * renditions are fully built (`src/ui/wallet/`) but the entry point is hidden.
 * Shipping real passes needs signing credentials we do not have yet: an Apple
 * PassKit pass-type certificate and a Google Wallet issuer account + service-
 * account key, plus a server-side signing step. Until those exist a "pass" would
 * be a non-functional mock, so the path is gated off rather than shown.
 * To re-enable: flip this to true (the code is intact) and wire the signer.
 * Status/reason also recorded in labs/docs/07-screen-by-screen-build-guide.md
 * (the Wallet entry) and labs/docs/11-frontend-backend-integration.md.
 */
export const WALLET_ENABLED = false;

/**
 * FINDABLE (doc 17, the vanity-name reach mode): the registration UI, the
 * onboarding "Findable" option, and the resolve→knock handoff are built behind
 * this. It stays off until the launch gate is met (consent disclosure shipped,
 * blocklist curated) AND the server's STI_FINDABLE_ENABLED is flipped on the box.
 * Flipping this true client-side without the server flag would let people try to
 * register names the server refuses, so the two move together at launch (F6).
 */
// Widened to `boolean` (not the literal `false`) so the `if (FINDABLE_ENABLED)`
// gate isn't flagged as an always-falsy dead branch; it flips to true at F6.
export const FINDABLE_ENABLED = false as boolean;

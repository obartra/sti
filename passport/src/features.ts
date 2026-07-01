/**
 * Build-time feature flags. A single, greppable place to gate features that are
 * implemented but intentionally not exposed yet.
 *
 * TECH DEBT, WALLET (Apple/Google Wallet passes): the wallet screen + pass
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

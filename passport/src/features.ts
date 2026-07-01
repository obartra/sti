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

/**
 * FINDABLE (doc 17, the vanity-name reach mode): the registration UI, the
 * onboarding "Findable" option, and the resolve→knock handoff are built behind
 * this. This is the F6 launch flip (true).
 *
 * Launch coupling: this MUST go live together with the server's
 * STI_FINDABLE_ENABLED (set on the box) and a populated blocklist.txt. With this
 * true but the server flag off, the client shows the Findable UI while the write
 * endpoints 405, so registration just fails. With both on but the blocklist empty,
 * the public name directory launches with no proactive slur/abuse filter, leaving
 * only reactive report-and-takedown. So this PR ships behind the operator enabling
 * the server flag AND curating blocklist.txt (doc 17 launch gate), not before.
 */
// Kept widened to `boolean` (not the literal `true`) so the `if (FINDABLE_ENABLED)`
// gate's other branch isn't flagged as dead code.
export const FINDABLE_ENABLED = true as boolean;

/**
 * RECOVERY (doc 32, the optional password factor): the Settings card to turn a
 * password on and off is built behind this. Gated off until launch, coupled to the
 * server's STI_RECOVERY_ENABLED: the /recovery endpoints are a bare 404 until that
 * is set, so with this true but the server flag off the card would show while
 * setup fails. Flip both together (and the new-device unlock path lands with it).
 */
// Widened to `boolean` so the gate's off-branch is not flagged as dead code.
export const RECOVERY_ENABLED = false as boolean;

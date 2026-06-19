/**
 * PassportStore is the single boundary the screens read through. The app binds
 * it to the real api + crypto layer; Storybook binds it to fixtures, so stories
 * keep rendering offline. It grows one method per backend-wiring slice; slice 2
 * introduces public resolution.
 */

import type { ResolvedView } from "../ui/public/PublicResolution.tsx";

/**
 * A shared passport link, split into the part that reaches the server (the
 * opaque read id) and the part that never does (the decryption key, carried in
 * the URL `#k=` fragment).
 */
export interface AliasLink {
  readonly id: string;
  /** base64url AES key from the link fragment; never sent to the server. */
  readonly key: string;
}

export interface PassportStore {
  /**
   * Resolve a shared link to a viewer card, or `null` for the uniform gray
   * state. `null` covers every failure indistinguishably: no/invalid key, a
   * miss, a decrypt failure, a malformed card, or an unreachable server.
   */
  resolveAlias(link: AliasLink): Promise<ResolvedView | null>;
}

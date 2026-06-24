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
  /**
   * Knock on an alias: a link-holder who lands on the uniform gray state asks the
   * owner for access. Existence-uniform (resolves whether or not the alias
   * exists) and contentless: it carries only an opaque per-device hash, never who
   * knocked. Resolves on success; callers treat any failure as a no-op.
   */
  knock(aliasId: string): Promise<void>;
  /**
   * Poll for an in-app grant the owner may have approved after a knock (doc 13):
   * resolves to the viewer card once the owner has sealed the alias key to this
   * device's grant key, or `null` while still pending / if this device never
   * knocked / on any failure. Existence-uniform and safe to call repeatedly.
   */
  redeemGrant(aliasId: string): Promise<ResolvedView | null>;
  /**
   * Findable (doc 17): resolve a public vanity name to the alias id it points at,
   * or `null` if the name is unregistered / unreachable. The viewer then runs the
   * normal knock flow against that id (a Findable name carries no key, so it is
   * the keyless gated path). Fail-closed to `null` like the others.
   */
  resolveVanityName(name: string): Promise<string | null>;
}

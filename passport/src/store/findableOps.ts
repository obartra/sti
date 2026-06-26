/**
 * The owner's Findable (vanity-name) operations (doc 17): claim a public name, and
 * release it. Extracted from the session controller like the other owner ops; these
 * are free functions taking the api + account manager, called by the controller's
 * thin method wrappers.
 *
 * A claimed name resolves to a DEDICATED public alias (not the share-sheet link), so
 * the two never collide and findability survives a share-link rotation. That alias
 * lives in the account's `aliases` list (so knocks to it are reviewed) but is owned
 * by this module: minted on claim, revoked on release, and excluded from the
 * share-link picker (see {@link primaryShareAlias}) and the live-links UI.
 *
 * The card published to the findable alias is keyless from the public side: a name
 * lookup navigates with the alias id only (no key), so a stranger sees gray-nothing
 * and a knock, never the owner's status, until the owner approves them.
 */

import type { ApiClient, VanityRegisterResult } from "../api/client.ts";
import type { AccountManager } from "./account.ts";
import type { AccountBlob, AliasRecord } from "./accountBlob.ts";
import { deriveAliasCard, withIdentity } from "./ownerCard.ts";
import { publishCard, revokeAlias } from "./publish.ts";
import { todayEpochDay } from "../core/clock.ts";
import type { OwnerSession } from "./session.ts";

/** The session after a claim attempt plus its outcome (the UI shows the result). */
export interface VanityRegisterOutcome {
  readonly session: OwnerSession;
  readonly result: VanityRegisterResult;
}

/**
 * The owner's primary SHARE alias for a visibility, excluding the dedicated findable
 * alias. The share sheet keeps "one alias per visibility"; the findable alias shares
 * a visibility (public) but must never be picked as the share link (reusing it would
 * republish over it and hand out its key-bearing URL). Selecting by visibility AND
 * not-the-findable-id keeps the two independent.
 */
export function primaryShareAlias(
  blob: AccountBlob,
  wantPublic: boolean,
): AliasRecord | undefined {
  const findableId = blob.findable?.aliasId;
  return blob.aliases.find(
    (a) => a.isPublic === wantPublic && a.id !== findableId,
  );
}

// Mint a dedicated public alias backing a findable name and publish the current
// card to it with an anonymous (id-derived, unlinkable) face. Returned record is
// stamped, ready to record in the blob.
async function mintFindableAlias(
  api: ApiClient,
  session: OwnerSession,
): Promise<AliasRecord> {
  const nowDay = todayEpochDay();
  const stamp = (rec: AliasRecord): AliasRecord =>
    withIdentity(rec, "anonymous", session.blob);
  const { record } = await publishCard(
    api,
    (rec) => deriveAliasCard(session.blob.state, stamp(rec), nowDay),
    { isPublic: true },
  );
  return stamp(record);
}

/**
 * Claim `name` for the owner. Mints + publishes a dedicated findable alias, asks the
 * server to bind the name to it, and on success records both the alias and the
 * registration in the blob. On "unavailable"/"error" the just-minted alias is
 * revoked (so no orphan public card lingers) and nothing is persisted. `name` must
 * already be normalized + validated by the caller; the server enforces the rules too.
 */
export async function registerVanityName(
  api: ApiClient,
  accounts: AccountManager,
  session: OwnerSession,
  name: string,
): Promise<VanityRegisterOutcome> {
  const alias = await mintFindableAlias(api, session);
  const result = await api
    .registerVanityName(name, alias.id, alias.writeToken)
    .catch((): VanityRegisterResult => "error");
  if (result !== "registered") {
    // The name did not bind to this alias; kill the card so it is not a reachable
    // orphan, and leave the blob untouched.
    await revokeAlias(api, alias).catch(() => undefined);
    return { session, result };
  }
  // One atomic write: the alias and its registration land together, so the alias is
  // never recorded without the registration that hides it from the live-links list.
  const blob = await accounts.recordFindable(session.master, alias, {
    name,
    aliasId: alias.id,
  });
  return { session: { master: session.master, blob }, result };
}

/**
 * Release the owner's claimed name: drop the server binding (into the 24h lock),
 * revoke the dedicated alias (overwrite its card), and clear the registration. Order
 * is fail-safe, the server release first (so the name stops resolving), then the
 * revoke, then the local teardown; any server failure leaves everything in the blob
 * for a retry. A no-op when no name is claimed.
 */
export async function releaseVanityName(
  api: ApiClient,
  accounts: AccountManager,
  session: OwnerSession,
): Promise<OwnerSession> {
  const reg = session.blob.findable;
  if (reg === undefined) return session;
  const alias = session.blob.aliases.find((a) => a.id === reg.aliasId);
  // Release on the server first. Without the alias's write token (an inconsistent
  // blob) we cannot prove ownership, so skip the server call and just clear locally.
  if (alias !== undefined) {
    await api.releaseVanityName(reg.name, alias.writeToken);
    // Overwrite the public card so the released alias is not a reachable orphan. Do
    // NOT swallow a failure here: if the revoke does not land, the card is still
    // live, so the local teardown must not run (it would drop the alias from the
    // blob and leave a status card the owner believes is gone, readable to anyone
    // holding the bare alias id). Throwing keeps the alias + registration in place;
    // a retry re-releases (idempotent on the server's 404) and re-revokes.
    await revokeAlias(api, alias);
    await accounts.removeAlias(session.master, alias.id);
  }
  const blob = await accounts.setFindable(session.master, null);
  return { master: session.master, blob };
}

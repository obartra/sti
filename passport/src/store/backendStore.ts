/**
 * The real PassportStore: api transport + crypto boundary + the public-card
 * codec. Resolution fails closed to `null` so existence stays undetectable.
 */

import type { ApiClient } from "../api/client.ts";
import { importAesKey, openSized, base64urlToBytes } from "../crypto/index.ts";
import { parsePublicCard } from "./publicCard.ts";
import { knock } from "./knock.ts";
import { redeemGrant } from "./grant.ts";
import { browserRequesterSecret } from "./requesterStore.ts";
import { browserGrantKeyStore, type GrantKeyStore } from "./grantKeyStore.ts";
import type { AliasLink, PassportStore } from "./passportStore.ts";

/**
 * @param requesterSecret the viewer's stable per-device knock secret. The app
 * passes the persisted one; omitting it (tests, Storybook) uses a fresh volatile
 * secret, which knocks fine but loses cross-session dedupe.
 * @param grantKeys the per-alias grant keypair store. Defaults to a browser-backed
 * one; tests/Storybook can inject an in-memory store.
 */
export function createBackendStore(
  api: ApiClient,
  requesterSecret: string = browserRequesterSecret(),
  grantKeys: GrantKeyStore = browserGrantKeyStore(),
): PassportStore {
  async function resolveAlias({ id, key }: AliasLink) {
    try {
      const payload = await api.getAlias(id);
      const aesKey = await importAesKey(base64urlToBytes(key));
      const plain = await openSized(aesKey, payload);
      return parsePublicCard(plain);
    } catch {
      // Every failure path lands here and renders the same uniform null state:
      // an unreachable or shed server, a miss (the server returned a decoy), a
      // decrypt failure (wrong key or another user's payload), a malformed
      // card, or a malformed key fragment. None is distinguishable to a viewer.
      return null;
    }
  }

  return {
    resolveAlias,

    async knock(aliasId: string) {
      // Carry this device's stable grant public key so the owner can seal an
      // in-app grant to it on Approve; the private half stays here. The salted
      // per-device hash is derived in knock(); the secret never leaves the
      // device, and the server response is existence-uniform.
      const kp = await grantKeys.forAlias(aliasId);
      await knock(api, aliasId, requesterSecret, kp.publicKey);
    },

    async redeemGrant(aliasId: string) {
      // Poll the grant slot. Null while still pending (a decoy), if this device
      // never knocked (no stored key), or on ANY failure — all indistinguishable.
      // The fail-closed try/catch here is what makes that contract true at the
      // store boundary even though store/grant's redeemGrant lets a transport
      // error propagate (so other callers could tell them apart).
      try {
        const privateKey = grantKeys.privateKey(aliasId);
        if (privateKey === null) return null;
        const key = await redeemGrant(
          api,
          aliasId,
          requesterSecret,
          privateKey,
        );
        if (key === null) return null;
        // Approved: open the now-readable alias into the card a keyed link gives.
        return await resolveAlias({ id: aliasId, key });
      } catch {
        return null;
      }
    },

    async resolveVanityName(name: string) {
      // Fail closed to null (unregistered / unreachable / malformed), so the
      // resolve step never distinguishes those for a viewer.
      try {
        return await api.resolveVanityName(name);
      } catch {
        return null;
      }
    },

    reportVanityName(name, reason) {
      // No fail-closed here: a report's success/failure IS shown to the reporter
      // (the form retries on error), so let a transport failure reject.
      return api.reportVanityName(name, reason);
    },
  };
}

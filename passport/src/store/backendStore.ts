/**
 * The real PassportStore: api transport + crypto boundary + the public-card
 * codec. Resolution fails closed to `null` so existence stays undetectable.
 */

import type { ApiClient } from "../api/client.ts";
import { importAesKey, openSized, base64urlToBytes } from "../crypto/index.ts";
import { parsePublicCard } from "./publicCard.ts";
import { knock } from "./knock.ts";
import { browserRequesterSecret } from "./requesterStore.ts";
import type { AliasLink, PassportStore } from "./passportStore.ts";

/**
 * @param requesterSecret the viewer's stable per-device knock secret. The app
 * passes the persisted one; omitting it (tests, Storybook) uses a fresh volatile
 * secret, which knocks fine but loses cross-session dedupe.
 */
export function createBackendStore(
  api: ApiClient,
  requesterSecret: string = browserRequesterSecret(),
): PassportStore {
  return {
    async resolveAlias({ id, key }: AliasLink) {
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
    },

    knock(aliasId: string) {
      // The salted per-device hash is derived here; the secret never leaves the
      // device. The server response is existence-uniform, so this resolves the
      // same whether or not the alias exists.
      return knock(api, aliasId, requesterSecret);
    },
  };
}

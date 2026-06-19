/**
 * The real PassportStore: api transport + crypto boundary + the public-card
 * codec. Resolution fails closed to `null` so existence stays undetectable.
 */

import type { ApiClient } from "../api/client.ts";
import { importAesKey, openSized, base64urlToBytes } from "../crypto/index.ts";
import { parsePublicCard } from "./publicCard.ts";
import type { AliasLink, PassportStore } from "./passportStore.ts";

export function createBackendStore(api: ApiClient): PassportStore {
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
  };
}

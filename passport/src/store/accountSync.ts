/**
 * Device-state sync: load and save the owner's encrypted account blob, addressed
 * by an id derived from their root key. A sibling of PassportStore (which is
 * screen-facing public resolution); this surface is used at onboarding, login,
 * and recovery, where the root key is in hand.
 *
 * The root key comes from a passkey (WebAuthn PRF) or a recovery passphrase;
 * either path produces the same 32-byte key (see crypto/keys.ts). This layer is
 * agnostic to how it was minted.
 */

import type { ApiClient } from "../api/client.ts";
import {
  importAesKey,
  seal,
  open,
  deriveAccountId,
  deriveAccountKey,
  deriveAccountWriteToken,
  type RootKey,
} from "../crypto/index.ts";
import {
  serializeAccountBlob,
  parseAccountBlob,
  type AccountBlob,
} from "./accountBlob.ts";

export interface AccountSync {
  /**
   * Load and decrypt the account blob for this root key. Returns null when no
   * blob exists yet (a new account). Throws if a blob exists but does not
   * decrypt or parse, which signals the wrong key (a wrong recovery passphrase),
   * distinct from "no account".
   */
  load(root: RootKey): Promise<AccountBlob | null>;
  /** Encrypt and store the account blob for this root key. */
  save(root: RootKey, blob: AccountBlob): Promise<void>;
  /** Delete the account blob for this root key (idempotent). */
  remove(root: RootKey): Promise<void>;
}

export function createAccountSync(api: ApiClient): AccountSync {
  // The account id and the blob key are independent derivations from the root,
  // so derive them together rather than serially.
  const derive = (root: RootKey) =>
    Promise.all([
      deriveAccountId(root),
      deriveAccountKey(root).then(importAesKey),
    ]);

  return {
    async load(root) {
      const [id, key] = await derive(root);
      const got = await api.getAccount(id);
      if (got === null) return null; // 404: no account yet
      return parseAccountBlob(await open(key, got.blob));
    },

    async save(root, blob) {
      const [id, key] = await derive(root);
      const [ct, writeToken] = await Promise.all([
        seal(key, serializeAccountBlob(blob)),
        deriveAccountWriteToken(root),
      ]);
      await api.putAccount(id, ct, writeToken);
    },

    async remove(root) {
      // The blob key is irrelevant to delete, but the write token still gates it:
      // the id alone (which travels on the wire) must not authorize removal.
      const [id, writeToken] = await Promise.all([
        deriveAccountId(root),
        deriveAccountWriteToken(root),
      ]);
      await api.deleteAccount(id, writeToken);
    },
  };
}

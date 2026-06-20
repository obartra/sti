/**
 * Device-state sync: load and save the owner's encrypted account blob, addressed
 * by an id derived from their master key. A sibling of PassportStore (which is
 * screen-facing public resolution); this surface is used at onboarding, login,
 * and recovery, where the master key is in hand.
 *
 * The master key comes from a passkey (WebAuthn PRF) or a recovery passphrase;
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
  type Bytes,
} from "../crypto/index.ts";
import {
  serializeAccountBlob,
  parseAccountBlob,
  type AccountBlob,
} from "./accountBlob.ts";

export interface AccountSync {
  /**
   * Load and decrypt the account blob for this master key. Returns null when no
   * blob exists yet (a new account). Throws if a blob exists but does not
   * decrypt or parse, which signals the wrong key (a wrong recovery passphrase),
   * distinct from "no account".
   */
  load(master: Bytes): Promise<AccountBlob | null>;
  /** Encrypt and store the account blob for this master key. */
  save(master: Bytes, blob: AccountBlob): Promise<void>;
  /** Delete the account blob for this master key (idempotent). */
  remove(master: Bytes): Promise<void>;
}

export function createAccountSync(api: ApiClient): AccountSync {
  // The account id and the blob key are independent derivations from the master,
  // so derive them together rather than serially.
  const derive = (master: Bytes) =>
    Promise.all([
      deriveAccountId(master),
      deriveAccountKey(master).then(importAesKey),
    ]);

  return {
    async load(master) {
      const [id, key] = await derive(master);
      const got = await api.getAccount(id);
      if (got === null) return null; // 404: no account yet
      return parseAccountBlob(await open(key, got.blob));
    },

    async save(master, blob) {
      const [id, key] = await derive(master);
      await api.putAccount(id, await seal(key, serializeAccountBlob(blob)));
    },

    async remove(master) {
      // Only the account id is needed to delete; the blob key is irrelevant.
      await api.deleteAccount(await deriveAccountId(master));
    },
  };
}

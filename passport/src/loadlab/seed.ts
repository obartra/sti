/**
 * Seed a synthetic owner population through the REAL client + crypto, so reads
 * hit real aliases (not only decoys) and the store rows are real. Each owner gets
 * a published alias (sealed to the fixed size and PUT under a random write token)
 * and a published account blob (addressed by an HKDF account id). The account
 * master is a random 32 bytes rather than a passphrase, which skips the expensive
 * PBKDF2 the wire does not need while keeping the real HKDF account-addressing.
 */
import type { ApiClient } from "../api/client.ts";
import { ALIAS_PAYLOAD_SIZE } from "../api/contract.ts";
import {
  importAesKey,
  seal,
  sealToSize,
  utf8ToBytes,
  randomAliasId,
  randomWriteToken,
  deriveAccountId,
  deriveAccountKey,
  type Bytes,
} from "../crypto/index.ts";

export interface SeededOwner {
  readonly aliasId: string;
  readonly writeToken: string;
  readonly aliasKeyRaw: Bytes;
  readonly aliasPlaintext: Bytes;
  readonly accountId: string;
  readonly accountKeyRaw: Bytes;
}

async function seedOne(api: ApiClient, i: number): Promise<SeededOwner> {
  const aliasKeyRaw = crypto.getRandomValues(new Uint8Array(32));
  const aliasPlaintext = utf8ToBytes(
    JSON.stringify({
      handle: `owner-${i}`,
      badge: i % 2 === 0 ? "blue" : "gray",
    }),
  );
  const payload = await sealToSize(
    await importAesKey(aliasKeyRaw),
    aliasPlaintext,
    ALIAS_PAYLOAD_SIZE,
  );
  const aliasId = randomAliasId();
  const writeToken = randomWriteToken();
  await api.putAlias(aliasId, payload, writeToken);

  const master = crypto.getRandomValues(new Uint8Array(32));
  const accountId = await deriveAccountId(master);
  const accountKeyRaw = await deriveAccountKey(master);
  const accountKey = await importAesKey(accountKeyRaw);
  const blob = await seal(
    accountKey,
    utf8ToBytes(JSON.stringify({ aliases: [aliasId] })),
  );
  await api.putAccount(accountId, blob);

  return {
    aliasId,
    writeToken,
    aliasKeyRaw,
    aliasPlaintext,
    accountId,
    accountKeyRaw,
  };
}

/** Seed `n` owners sequentially. Returns the capabilities needed to read each back. */
export async function seedOwners(
  api: ApiClient,
  n: number,
): Promise<SeededOwner[]> {
  const owners: SeededOwner[] = [];
  for (let i = 0; i < n; i++) owners.push(await seedOne(api, i));
  return owners;
}

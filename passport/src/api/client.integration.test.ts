// @vitest-environment node
//
// The real round-trip: a typed client against a live instance of the Go blind
// store, proving data actually flows (publish -> resolve -> decrypt equals what
// was published), not just that the wiring compiles. Per doc 11, a mock would
// prove nothing here. The server harness is shared with the other integration
// tests (src/test-support/serverHarness.ts).
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApiClient, ApiError } from "./client.ts";
import { ALIAS_PAYLOAD_SIZE, ID_ENCODED_LEN } from "./contract.ts";
import {
  importAesKey,
  seal,
  open,
  sealToSize,
  openSized,
  utf8ToBytes,
  bytesToUtf8,
  randomAliasId,
  randomWriteToken,
  deriveMasterKey,
  deriveAccountId,
  deriveAccountKey,
} from "../crypto/index.ts";
import {
  startApi,
  randomHex,
  type Harness,
} from "../test-support/serverHarness.ts";

describe("api client against a live blind store", () => {
  let harness: Harness | undefined;
  let api!: ReturnType<typeof createApiClient>;

  beforeAll(async () => {
    harness = await startApi();
    api = createApiClient(harness.baseUrl);
  }, 120_000);

  afterAll(() => harness?.stop());

  it("reports healthy", async () => {
    expect(await api.health()).toBe(true);
  });

  it("round-trips an alias: publish, resolve, decrypt equals published", async () => {
    const id = randomAliasId();
    const writeToken = randomWriteToken();
    expect(id).toHaveLength(ID_ENCODED_LEN);
    const key = await importAesKey(crypto.getRandomValues(new Uint8Array(32)));

    const plaintext = utf8ToBytes(
      JSON.stringify({ handle: "robin", badge: "blue", labels: ["hiv"] }),
    );
    const payload = await sealToSize(key, plaintext, ALIAS_PAYLOAD_SIZE);
    await api.putAlias(id, payload, writeToken);

    const fetched = await api.getAlias(id);
    // Drift guard: the server's fixed size must match the contract constant.
    expect(fetched.length).toBe(ALIAS_PAYLOAD_SIZE);
    expect(bytesToUtf8(await openSized(key, fetched))).toBe(
      bytesToUtf8(plaintext),
    );
  });

  it("a miss is existence-uniform: same fixed size, fails to open like a wrong key", async () => {
    const key = await importAesKey(crypto.getRandomValues(new Uint8Array(32)));

    const missId = randomAliasId(); // never written
    const decoy = await api.getAlias(missId);
    expect(decoy.length).toBe(ALIAS_PAYLOAD_SIZE); // identical size to a real one
    await expect(openSized(key, decoy)).rejects.toThrow(); // -> null resolution

    // A real payload opened with the wrong key fails the same way, so a viewer
    // cannot tell "does not exist" from "exists, not for me".
    const id = randomAliasId();
    const realKey = await importAesKey(
      crypto.getRandomValues(new Uint8Array(32)),
    );
    await api.putAlias(
      id,
      await sealToSize(realKey, utf8ToBytes("real"), ALIAS_PAYLOAD_SIZE),
      randomWriteToken(),
    );
    const real = await api.getAlias(id);
    expect(real.length).toBe(ALIAS_PAYLOAD_SIZE);
    await expect(openSized(key, real)).rejects.toThrow();
  });

  it("rejects an overwrite with the wrong write token", async () => {
    const id = randomAliasId();
    const key = await importAesKey(crypto.getRandomValues(new Uint8Array(32)));
    const payload = await sealToSize(
      key,
      utf8ToBytes("v1"),
      ALIAS_PAYLOAD_SIZE,
    );
    await api.putAlias(id, payload, randomWriteToken());

    const err = await api
      .putAlias(id, payload, randomWriteToken())
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).kind).toBe("forbidden");
  });

  it("round-trips the account-sync blob and reports a version", async () => {
    const master = await deriveMasterKey("recovery phrase");
    const accountId = await deriveAccountId(master);
    const key = await importAesKey(await deriveAccountKey(master));

    expect(await api.getAccount(accountId)).toBeNull(); // empty account

    const plaintext = utf8ToBytes(
      JSON.stringify({ aliases: ["a", "b"], circles: [] }),
    );
    const put = await api.putAccount(accountId, await seal(key, plaintext));
    expect(put.version).toBeTruthy();

    const got = await api.getAccount(accountId);
    if (got === null) throw new Error("expected an account blob");
    expect(bytesToUtf8(await open(key, got.blob))).toBe(bytesToUtf8(plaintext));
  });

  it("knock and notify complete without leaking existence", async () => {
    const id = randomAliasId();
    await expect(api.knock(id, randomHex(16))).resolves.toBeUndefined();
    await expect(api.notify(randomHex(16))).resolves.toBeUndefined();
  });
});

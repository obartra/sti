// @vitest-environment node
//
// The real round-trip: a typed client against a live instance of the Go blind
// store, proving data actually flows (publish -> resolve -> decrypt equals what
// was published), not just that the wiring compiles. Per doc 11, a mock would
// prove nothing here. The server harness is shared with the other integration
// tests (src/test-support/serverHarness.ts).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rootForTest } from "../test-support/phrase.ts";

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
  bytesToBase64url,
  deriveAccountId,
  deriveAccountKey,
  deriveAccountWriteToken,
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

  it("getVapidPublicKey is null when the server has no push keys configured", async () => {
    // The harness runs without VAPID keys, so /vapid answers an empty key, which
    // the client surfaces as null ("push unavailable") rather than an error.
    expect(await api.getVapidPublicKey()).toBeNull();
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
    const root = await rootForTest("recovery phrase");
    const accountId = await deriveAccountId(root);
    const key = await importAesKey(await deriveAccountKey(root));
    const writeToken = await deriveAccountWriteToken(root);

    expect(await api.getAccount(accountId)).toBeNull(); // empty account

    const plaintext = utf8ToBytes(
      JSON.stringify({ aliases: ["a", "b"], circles: [] }),
    );
    const put = await api.putAccount(
      accountId,
      await seal(key, plaintext),
      writeToken,
    );
    expect(put.version).toBeTruthy();

    const got = await api.getAccount(accountId);
    if (got === null) throw new Error("expected an account blob");
    expect(bytesToUtf8(await open(key, got.blob))).toBe(bytesToUtf8(plaintext));

    // The write token gates overwrite end to end: a different token (someone who
    // only observed the id on the wire) is forbidden by the real server, and the
    // owner's token still works.
    const foreign = await api
      .putAccount(accountId, await seal(key, plaintext), "not-the-write-token")
      .catch((e: unknown) => e);
    expect(foreign).toBeInstanceOf(ApiError);
    expect((foreign as ApiError).kind).toBe("forbidden");
    await expect(
      api.deleteAccount(accountId, writeToken),
    ).resolves.toBeUndefined();
  });

  it("knock and notify complete without leaking existence", async () => {
    const id = randomAliasId();
    await expect(api.knock(id, randomHex(16))).resolves.toBeUndefined();
    await expect(api.notify(randomHex(16))).resolves.toBeUndefined();
  });

  // A republish batch round-trips end to end: the server accepts the base64url
  // fixed-size payloads (so the client encoding matches the server decode) and the
  // deferred overwrite actually lands. A dedicated instance with no jitter window and
  // a fast janitor so the apply is observable within the test.
  it("applies a deferred republish batch (decorrelation wire + encoding)", async () => {
    const h = await startApi({
      env: { STI_REPUBLISH_WINDOW: "0", STI_JANITOR_INTERVAL: "120ms" },
    });
    try {
      const rapi = createApiClient(h.baseUrl);
      const key = await importAesKey(
        crypto.getRandomValues(new Uint8Array(32)),
      );
      // Two aliases, each bound with its write token by an initial publish.
      const aliases = await Promise.all(
        [1, 2].map(async () => {
          const id = randomAliasId();
          const writeToken = randomWriteToken();
          await rapi.putAlias(
            id,
            await sealToSize(key, utf8ToBytes("old"), ALIAS_PAYLOAD_SIZE),
            writeToken,
          );
          return { id, writeToken };
        }),
      );
      // Hand both updates to the server as one decorrelation batch.
      const next = await sealToSize(
        key,
        utf8ToBytes("new"),
        ALIAS_PAYLOAD_SIZE,
      );
      await rapi.republish(
        aliases.map((a) => ({
          id: a.id,
          ciphertext: bytesToBase64url(next),
          writeToken: a.writeToken,
        })),
      );
      // The janitor applies the deferred writes; poll until both cards update.
      for (const a of aliases) {
        let applied = false;
        for (let i = 0; i < 40 && !applied; i++) {
          const got = await rapi.getAlias(a.id);
          applied = bytesToUtf8(await openSized(key, got)) === "new";
          if (!applied) await new Promise((r) => setTimeout(r, 50));
        }
        expect(applied).toBe(true);
      }
    } finally {
      h.stop();
    }
  }, 30_000);
});

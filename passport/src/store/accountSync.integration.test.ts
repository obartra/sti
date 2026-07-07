// @vitest-environment node
// Account sync proven against a live blind store: save the device blob, load it
// back to the same value, and confirm a fresh root key sees no account.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rootForTest } from "../test-support/phrase.ts";

import { createApiClient } from "../api/client.ts";
import { createAccountSync } from "./accountSync.ts";
import type { AccountBlob } from "./accountBlob.ts";
import { INITIAL_OWNER_STATE } from "../core/badge.ts";
import { DEFAULT_AVATAR } from "../lib/avatars.ts";
import {
  startApi,
  randomHex,
  type Harness,
} from "../test-support/serverHarness.ts";

describe("account sync against a live blind store", () => {
  let harness: Harness | undefined;
  let sync!: ReturnType<typeof createAccountSync>;

  beforeAll(async () => {
    harness = await startApi();
    sync = createAccountSync(createApiClient(harness.baseUrl));
  }, 120_000);

  afterAll(() => harness?.stop());

  it("saves and loads the device blob", async () => {
    // Unique passphrase per run so reruns against a persistent server do not
    // collide on the derived account id.
    const root = await rootForTest(randomHex(16));
    const blob: AccountBlob = {
      handle: "robin",
      aliases: [
        {
          id: "A".repeat(43),
          writeToken: "B".repeat(43),
          key: "C".repeat(43),
          isPublic: true,
        },
      ],
      contacts: [],
      state: INITIAL_OWNER_STATE,
      avatar: DEFAULT_AVATAR,
    };

    expect(await sync.load(root)).toBeNull(); // no account yet
    await sync.save(root, blob);
    expect(await sync.load(root)).toEqual(blob);
  });

  it("a fresh root sees no account", async () => {
    const root = await rootForTest(randomHex(16));
    expect(await sync.load(root)).toBeNull();
  });
});

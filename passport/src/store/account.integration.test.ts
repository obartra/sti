// @vitest-environment node
// Account lifecycle proven against a live blind store: create an account,
// recover it from its phrase, record an alias, and confirm recovery sees it.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApiClient } from "../api/client.ts";
import { createAccountManager } from "./index.ts";
import type { AliasRecord } from "./accountBlob.ts";
import { INITIAL_OWNER_STATE } from "../core/badge.ts";
import { startApi, type Harness } from "../test-support/serverHarness.ts";

const record: AliasRecord = {
  id: "A".repeat(43),
  writeToken: "B".repeat(43),
  key: "C".repeat(43),
  isPublic: true,
};

describe("account lifecycle against a live blind store", () => {
  let harness: Harness | undefined;
  let accounts!: ReturnType<typeof createAccountManager>;

  beforeAll(async () => {
    harness = await startApi();
    accounts = createAccountManager(createApiClient(harness.baseUrl));
  }, 120_000);

  afterAll(() => harness?.stop());

  it("creates an account and recovers it from the phrase", async () => {
    const created = await accounts.create("robin");
    expect(created.recoveryPhrase).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(created.blob).toEqual({
      handle: "robin",
      aliases: [],
      state: INITIAL_OWNER_STATE,
    });

    const recovered = await accounts.recover(created.recoveryPhrase);
    expect(recovered?.blob).toEqual({
      handle: "robin",
      aliases: [],
      state: INITIAL_OWNER_STATE,
    });
  });

  it("records an alias that survives a fresh recovery", async () => {
    const created = await accounts.create("sam");
    await accounts.addAlias(created.master, record);

    const recovered = await accounts.recover(created.recoveryPhrase);
    expect(recovered?.blob.aliases).toEqual([record]);
  });

  it("returns null recovering with an unknown phrase", async () => {
    const fresh = await accounts.create("nobody");
    // A different phrase derives a different account id, so it sees nothing.
    expect(await accounts.recover(fresh.recoveryPhrase + "x")).toBeNull();
  });
});

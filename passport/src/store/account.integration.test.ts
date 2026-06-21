// @vitest-environment node
// Account lifecycle proven against a live blind store: create an account,
// recover it from its phrase, record an alias, and confirm recovery sees it.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApiClient } from "../api/client.ts";
import { createAccountManager } from "./index.ts";
import type { AliasRecord } from "./accountBlob.ts";
import { INITIAL_OWNER_STATE } from "../core/badge.ts";
import { DEFAULT_AVATAR } from "../lib/avatars.ts";
import { startApi, type Harness } from "../test-support/serverHarness.ts";

const FRESH = {
  aliases: [],
  contacts: [],
  state: INITIAL_OWNER_STATE,
  avatar: DEFAULT_AVATAR,
  sharingMode: "link" as const,
};

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
    // A fresh account mints a stable myNotify identity (doc 13 slice 5); the rest
    // of the blob is the fresh default.
    const { myNotify, ...rest } = created.blob;
    expect(rest).toEqual({ handle: "robin", ...FRESH });
    const cap = /^[A-Za-z0-9_-]{43}$/;
    expect(myNotify?.inboxId).toMatch(cap);
    expect(myNotify?.writeToken).toMatch(cap);
    expect(myNotify?.key).toMatch(cap);
    expect(myNotify?.routingToken).toMatch(cap);

    // Recovery sees the same blob, myNotify included (it persists, not re-minted).
    const recovered = await accounts.recover(created.recoveryPhrase);
    expect(recovered?.blob).toEqual(created.blob);
  });

  it("persists a profile change (avatar + sharing) across recovery", async () => {
    const created = await accounts.create("robin");
    const avatar = { animal: 2, color: 1, hat: 1, glasses: 0, extra: 0 };
    await accounts.setProfile(created.master, {
      avatar,
      sharingMode: "public",
    });

    const recovered = await accounts.recover(created.recoveryPhrase);
    expect(recovered?.blob.avatar).toEqual(avatar);
    expect(recovered?.blob.sharingMode).toBe("public");
    // The badge inputs are untouched by a profile change.
    expect(recovered?.blob.state).toEqual(INITIAL_OWNER_STATE);
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

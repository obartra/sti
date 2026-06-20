// @vitest-environment node
// The full owner loop against a live blind store: create an account, publish the
// owner's card to an alias, then change the owner's state (a pause) and confirm
// every shared link flips to the new badge and the state survives recovery.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApiClient } from "../api/client.ts";
import {
  createAccountManager,
  createBackendStore,
  publishCard,
  deriveOwnerCard,
} from "./index.ts";
import type { OwnerState } from "../core/badge.ts";
import { startApi, type Harness } from "../test-support/serverHarness.ts";

const blue: OwnerState = {
  testing: {
    hasEverTested: true,
    lastPanelAgeDays: 10,
    corePanelComplete: true,
    exposedSitesCovered: true,
  },
  hiv: "negative",
  activeNonHivSti: false,
  onPrep: true,
  condomPreference: "none",
  condomPreferencePublic: false,
  onDoxyPep: false,
  paused: false,
};

describe("owner loop against a live blind store", () => {
  let harness: Harness | undefined;
  let api!: ReturnType<typeof createApiClient>;
  let accounts!: ReturnType<typeof createAccountManager>;
  let store!: ReturnType<typeof createBackendStore>;

  beforeAll(async () => {
    harness = await startApi();
    api = createApiClient(harness.baseUrl);
    accounts = createAccountManager(api);
    store = createBackendStore(api);
  }, 120_000);

  afterAll(() => harness?.stop());

  it("create -> publish -> change state -> every link reflects the new badge", async () => {
    const created = await accounts.create("robin");
    await accounts.setOwnerState(created.master, blue);

    // Publish the owner's (blue) card to an alias and record it.
    const card = deriveOwnerCard(blue, "robin");
    const { record } = await publishCard(api, card);
    await accounts.addAlias(created.master, record);
    expect(
      await store.resolveAlias({ id: record.id, key: record.key }),
    ).toEqual(card);

    // The owner pauses: setOwnerState republishes every alias.
    const paused: OwnerState = { ...blue, paused: true };
    await accounts.setOwnerState(created.master, paused);

    const grayCard = deriveOwnerCard(paused, "robin");
    expect(grayCard.state).toBe("gray");
    expect(
      await store.resolveAlias({ id: record.id, key: record.key }),
    ).toEqual(grayCard);

    // The new state survives a fresh recovery.
    const recovered = await accounts.recover(created.recoveryPhrase);
    expect(recovered?.blob.state).toEqual(paused);
    expect(recovered?.blob.aliases).toEqual([record]);
  });
});

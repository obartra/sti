// @vitest-environment node
// Account lifecycle proven against a live blind store: create an account,
// recover it from its phrase, record an alias, and confirm recovery sees it.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApiClient } from "../api/client.ts";
import {
  createAccountManager,
  createBackendStore,
  deriveAliasCard,
  publishCard,
} from "./index.ts";
import type { AliasRecord } from "./accountBlob.ts";
import { INITIAL_OWNER_STATE } from "../core/badge.ts";
import { NOW_DAY } from "../core/badge.fixtures.ts";
import { todayEpochDay } from "../core/clock.ts";
import { DEFAULT_AVATAR } from "../lib/avatars.ts";
import type { AvatarConfig } from "../lib/avatars.ts";
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
  let api!: ReturnType<typeof createApiClient>;
  let accounts!: ReturnType<typeof createAccountManager>;

  beforeAll(async () => {
    harness = await startApi();
    api = createApiClient(harness.baseUrl);
    accounts = createAccountManager(api);
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

  it("does not propagate a main-identity edit to a link's per-alias face (doc 15)", async () => {
    const created = await accounts.create("robin");
    const store = createBackendStore(api);

    const newAvatar: AvatarConfig = {
      animal: 2,
      color: 1,
      hat: 1,
      glasses: 0,
      extra: 0,
    };

    // Publish two live links the real way, so each carries its own per-alias face
    // derived from its id (anonymous, no override). NOW_DAY is safe because
    // INITIAL_OWNER_STATE is never-tested, so the badge is day-independent.
    const alias = await publishCard(
      api,
      (rec) => deriveAliasCard(created.blob.state, rec, NOW_DAY),
      { isPublic: true },
    );
    const liveLink = await publishCard(
      api,
      (rec) => deriveAliasCard(created.blob.state, rec, NOW_DAY),
      { isPublic: false },
    );
    await accounts.addAlias(created.master, alias.record);
    await accounts.addContact(created.master, {
      id: "L".repeat(43),
      label: "",
      createdDay: 0,
      expiresDay: null,
      alias: liveLink.record,
    });

    const aliasFace = deriveAliasCard(
      created.blob.state,
      alias.record,
      NOW_DAY,
    );
    const liveFace = deriveAliasCard(
      created.blob.state,
      liveLink.record,
      NOW_DAY,
    );
    // An anonymous link carries no avatar (the viewer derives one from the handle).
    expect(aliasFace.avatar).toBeUndefined();

    // Edit the main identity's avatar (and sharing default). The badge is untouched.
    await accounts.setProfile(created.master, {
      avatar: newAvatar,
      sharingMode: "public",
    });

    // Both links are UNCHANGED: a main-identity edit does not reach an alias's
    // face, so neither picks up newAvatar (doc 15 non-goal). Each keeps its own
    // per-alias face.
    expect(
      await store.resolveAlias({ id: alias.record.id, key: alias.record.key }),
    ).toEqual(aliasFace);
    expect(
      await store.resolveAlias({
        id: liveLink.record.id,
        key: liveLink.record.key,
      }),
    ).toEqual(liveFace);
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

  it("setOwnerState sweeps an expired alias link (doc 16): it stops resolving", async () => {
    const store = createBackendStore(api);
    const created = await accounts.create("dev");
    // A real, resolvable alias, recorded with an expiry already in the past.
    const live = await publishCard(
      api,
      (rec) => deriveAliasCard(created.blob.state, rec, NOW_DAY),
      { isPublic: true },
    );
    await accounts.addAlias(created.master, {
      ...live.record,
      expiresDay: 1,
    });
    const caps = { id: live.record.id, key: live.record.key };
    expect(await store.resolveAlias(caps)).not.toBeNull();

    // The next state change sweeps the expired alias: it is dropped from the
    // blob and its link no longer resolves.
    const after = await accounts.setOwnerState(
      created.master,
      INITIAL_OWNER_STATE,
    );
    expect(after.aliases).toHaveLength(0);
    expect(await store.resolveAlias(caps)).toBeNull();
  });

  it("sweepExpiredLinks enforces expiry on load, no state change needed (doc 16)", async () => {
    const store = createBackendStore(api);
    const created = await accounts.create("quinn");
    const live = await publishCard(
      api,
      (rec) => deriveAliasCard(created.blob.state, rec, NOW_DAY),
      { isPublic: true },
    );
    await accounts.addAlias(created.master, { ...live.record, expiresDay: 1 });
    const caps = { id: live.record.id, key: live.record.key };
    expect(await store.resolveAlias(caps)).not.toBeNull();

    // A bare load-time sweep (no setOwnerState) revokes + drops the expired link,
    // closing the passive-owner gap.
    const swept = await accounts.sweepExpiredLinks(created.master);
    expect(swept.aliases).toHaveLength(0);
    expect(await store.resolveAlias(caps)).toBeNull();
  });

  it("sweepExpiredLinks is a no-op when nothing is expired (live link untouched)", async () => {
    const future = todayEpochDay() + 30; // safely live vs the real today the sweep uses
    const created = await accounts.create("wren");
    await accounts.addAlias(created.master, { ...record, expiresDay: future });
    const swept = await accounts.sweepExpiredLinks(created.master);
    expect(swept.aliases).toHaveLength(1);
    expect(swept.aliases[0]?.expiresDay).toBe(future);
  });
});

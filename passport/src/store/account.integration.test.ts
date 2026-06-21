// @vitest-environment node
// Account lifecycle proven against a live blind store: create an account,
// recover it from its phrase, record an alias, and confirm recovery sees it.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApiClient } from "../api/client.ts";
import {
  createAccountManager,
  createBackendStore,
  deriveOwnerCard,
  publishCard,
} from "./index.ts";
import type { AliasRecord, ContactRecord } from "./accountBlob.ts";
import { INITIAL_OWNER_STATE } from "../core/badge.ts";
import { NOW_DAY } from "../core/badge.fixtures.ts";
import { DEFAULT_AVATAR, avatarSrc } from "../lib/avatars.ts";
import type { AvatarConfig } from "../lib/avatars.ts";
import type { ResolvedView } from "../ui/public/PublicResolution.tsx";
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

  it("propagates an avatar edit to live shared links", async () => {
    const created = await accounts.create("robin");
    const store = createBackendStore(api);

    // The new avatar the owner will pick, and the card their live links should
    // resolve to afterwards: badge unchanged, sealed with the new avatar.
    const newAvatar: AvatarConfig = {
      animal: 2,
      color: 1,
      hat: 1,
      glasses: 0,
      extra: 0,
    };
    // Deriving with NOW_DAY (vs setProfile's real todayEpochDay) is safe only
    // because INITIAL_OWNER_STATE is never-tested, so the badge is unconditionally
    // gray and the card is day-independent. A blue-eligible fixture would make
    // this day-sensitive.
    const current = deriveOwnerCard(
      created.blob.state,
      "robin",
      NOW_DAY,
      newAvatar,
    );

    // Seed three links with a deliberately STALE card (different handle AND a
    // different avatar) as if published earlier and never refreshed: a public
    // alias, a live per-contact link, and an already-expired per-contact link.
    const staleAvatar: AvatarConfig = {
      animal: 4,
      color: 2,
      hat: 0,
      glasses: 1,
      extra: 0,
    };
    const stale: ResolvedView = {
      state: "blue",
      labels: ["hiv"],
      route: "hiv",
      identity: { handle: "stranger" },
      avatar: staleAvatar,
    };
    const alias = await publishCard(api, stale, { isPublic: true });
    const liveLink = await publishCard(api, stale, { isPublic: false });
    const expiredLink = await publishCard(api, stale, { isPublic: false });

    await accounts.addAlias(created.master, alias.record);
    const liveContact: ContactRecord = {
      id: "L".repeat(43),
      label: "",
      createdDay: 0,
      expiresDay: null,
      alias: liveLink.record,
    };
    const expiredContact: ContactRecord = {
      id: "E".repeat(43),
      label: "",
      createdDay: 0,
      // Expiry day 1 is always in the past, so this link is never re-sealed.
      expiresDay: 1,
      alias: expiredLink.record,
    };
    await accounts.addContact(created.master, liveContact);
    await accounts.addContact(created.master, expiredContact);

    // Edit only the avatar (and sharing default). The badge is untouched.
    await accounts.setProfile(created.master, {
      avatar: newAvatar,
      sharingMode: "public",
    });

    // The live alias and live contact link now resolve to the owner's current
    // card carrying the NEW avatar: the avatar edit propagated like a badge
    // change.
    const resolvedAlias = await store.resolveAlias({
      id: alias.record.id,
      key: alias.record.key,
    });
    expect(resolvedAlias).toEqual(current);
    expect(resolvedAlias?.avatar).toEqual(newAvatar);
    expect(
      await store.resolveAlias({
        id: liveLink.record.id,
        key: liveLink.record.key,
      }),
    ).toEqual(current);

    // The expired contact link is skipped (never resurrected): it still holds
    // its old payload, including the old avatar (resolution adds the rendered
    // avatarSrc the viewer would show).
    expect(
      await store.resolveAlias({
        id: expiredLink.record.id,
        key: expiredLink.record.key,
      }),
    ).toEqual({ ...stale, avatarSrc: avatarSrc(staleAvatar) });
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

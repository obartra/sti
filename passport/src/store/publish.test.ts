// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  publishCard,
  republishCard,
  revokeAlias,
  aliasLinkUrl,
} from "./publish.ts";
import { ALIAS_PAYLOAD_SIZE } from "../api/contract.ts";
import type { ApiClient } from "../api/client.ts";
import type { AliasRecord } from "./accountBlob.ts";
import type { ResolvedView } from "../ui/public/PublicResolution.tsx";

const view: ResolvedView = {
  state: "blue",
  labels: ["hiv"],
  route: "hiv",
  identity: { handle: "robin" },
};

const ID43 = /^[A-Za-z0-9_-]{43}$/;

interface PutCall {
  id: string;
  payload: Uint8Array;
  writeToken: string;
  expiresAt?: number | null | undefined;
}

function recordingApi(): { api: ApiClient; puts: PutCall[] } {
  const puts: PutCall[] = [];
  const unused = () => {
    throw new Error("not used in this test");
  };
  return {
    puts,
    api: {
      getAlias: unused,
      getAccount: unused,
      putAccount: unused,
      deleteAccount: unused,
      notify: unused,
      republish: unused,
      knockCount: () => Promise.resolve(0),
      knockReview: () => Promise.resolve({ count: 0, pending: [] }),
      getInbox: unused,
      putInbox: unused,
      knock: unused,
      registerPush: unused,
      getVapidPublicKey: unused,
      registerVanityName: unused,
      releaseVanityName: unused,
      resolveVanityName: unused,
      reportVanityName: unused,
      getRecoveryEnvelope: unused,
      putRecoveryEnvelope: unused,
      deleteRecoveryEnvelope: unused,
      health: unused,
      putAlias: (id, payload, writeToken, expiresAt) => {
        puts.push({ id, payload, writeToken, expiresAt });
        return Promise.resolve();
      },
    },
  };
}

describe("publishCard", () => {
  it("mints distinct capabilities and PUTs a fixed-size payload", async () => {
    const { api, puts } = recordingApi();
    const { record } = await publishCard(api, () => view);

    expect(record.id).toMatch(ID43);
    expect(record.writeToken).toMatch(ID43);
    expect(record.key).toMatch(ID43);
    // The three capabilities are independent draws.
    expect(new Set([record.id, record.writeToken, record.key]).size).toBe(3);
    expect(record.isPublic).toBe(true);

    expect(puts).toHaveLength(1);
    expect(puts[0]?.id).toBe(record.id);
    expect(puts[0]?.writeToken).toBe(record.writeToken);
    expect(puts[0]?.payload.length).toBe(ALIAS_PAYLOAD_SIZE);
  });

  it("builds a public link with the key in the fragment", async () => {
    const { api } = recordingApi();
    const { link, record } = await publishCard(api, () => view);
    expect(link).toBe(`https://sti.care/a/${record.id}#k=${record.key}`);
  });

  it("omits the key fragment for a private alias", async () => {
    const { api } = recordingApi();
    const { link, record } = await publishCard(api, () => view, {
      isPublic: false,
    });
    expect(record.isPublic).toBe(false);
    expect(link).toBe(`https://sti.care/a/${record.id}`);
  });

  it("aliasLinkUrl matches the record's publicness", () => {
    const rec: AliasRecord = {
      id: "A".repeat(43),
      writeToken: "B".repeat(43),
      key: "C".repeat(43),
      isPublic: true,
    };
    expect(aliasLinkUrl(rec)).toContain(`#k=${rec.key}`);
    expect(aliasLinkUrl({ ...rec, isPublic: false })).not.toContain("#k=");
  });
});

describe("public links never carry a server expiry (doc 16)", () => {
  const SOON = 1_900_000_000_000;

  it("publishCard drops an expiry passed for a public alias", async () => {
    const { api, puts } = recordingApi();
    const { record } = await publishCard(api, () => view, {
      isPublic: true,
      expiresAt: SOON,
    });
    expect(record.expiresAt).toBeNull();
    expect(puts[0]?.expiresAt).toBeNull();
  });

  it("publishCard still honours an expiry for a private link", async () => {
    const { api, puts } = recordingApi();
    const { record } = await publishCard(api, () => view, {
      isPublic: false,
      expiresAt: SOON,
    });
    expect(record.expiresAt).toBe(SOON);
    expect(puts[0]?.expiresAt).toBe(SOON);
  });

  it("republishCard clears a public alias's expiry even if one is asked for", async () => {
    const { api, puts } = recordingApi();
    const { record } = await publishCard(api, () => view); // public
    await republishCard(api, { ...record, expiresAt: SOON }, view, SOON);
    expect(puts[1]?.expiresAt).toBeNull();
  });

  it("republishCard still moves a private link's expiry", async () => {
    const { api, puts } = recordingApi();
    const { record } = await publishCard(api, () => view, {
      isPublic: false,
    });
    await republishCard(api, record, view, SOON);
    expect(puts[1]?.expiresAt).toBe(SOON);
  });
});

describe("revokeAlias", () => {
  it("overwrites with fixed-size, non-deterministic bytes using the write token", async () => {
    const { api, puts } = recordingApi();
    const { record } = await publishCard(api, () => view);
    const sealed = puts[0]?.payload;

    await revokeAlias(api, record);
    await revokeAlias(api, record);

    // Both revokes target the same alias with its write token, at the fixed size.
    expect(puts).toHaveLength(3);
    for (const put of puts.slice(1)) {
      expect(put.id).toBe(record.id);
      expect(put.writeToken).toBe(record.writeToken);
      expect(put.payload.length).toBe(ALIAS_PAYLOAD_SIZE);
    }
    // The overwrite is random, not the sealed card and not a repeat of itself, so
    // the old key can never decrypt it again (no future reads).
    expect(puts[1]?.payload).not.toEqual(sealed);
    expect(puts[1]?.payload).not.toEqual(puts[2]?.payload);
  });
});

// @vitest-environment node
import { describe, it, expect } from "vitest";
import { publishCard, revokeAlias, aliasLinkUrl } from "./publish.ts";
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
      knock: unused,
      registerPush: unused,
      health: unused,
      putAlias: (id, payload, writeToken) => {
        puts.push({ id, payload, writeToken });
        return Promise.resolve();
      },
    },
  };
}

describe("publishCard", () => {
  it("mints distinct capabilities and PUTs a fixed-size payload", async () => {
    const { api, puts } = recordingApi();
    const { record } = await publishCard(api, view);

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
    const { link, record } = await publishCard(api, view);
    expect(link).toBe(`https://sti.care/a/${record.id}#k=${record.key}`);
  });

  it("omits the key fragment for a private alias", async () => {
    const { api } = recordingApi();
    const { link, record } = await publishCard(api, view, { isPublic: false });
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

describe("revokeAlias", () => {
  it("overwrites with fixed-size, non-deterministic bytes using the write token", async () => {
    const { api, puts } = recordingApi();
    const { record } = await publishCard(api, view);
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

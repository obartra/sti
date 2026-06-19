import { describe, it, expect } from "vitest";
import { serializeAccountBlob, parseAccountBlob } from "./accountBlob.ts";
import { utf8ToBytes } from "../crypto/index.ts";
import { INITIAL_OWNER_STATE } from "../core/badge.ts";
import type { AccountBlob } from "./accountBlob.ts";

const ID = "A".repeat(43);
const blob: AccountBlob = {
  handle: "robin",
  aliases: [
    { id: ID, writeToken: "B".repeat(43), key: "C".repeat(43), isPublic: true },
  ],
  state: INITIAL_OWNER_STATE,
};

describe("account blob codec", () => {
  it("round-trips", () => {
    expect(parseAccountBlob(serializeAccountBlob(blob))).toEqual(blob);
  });

  it("round-trips an empty alias list", () => {
    const empty: AccountBlob = {
      handle: "sam",
      aliases: [],
      state: INITIAL_OWNER_STATE,
    };
    expect(parseAccountBlob(serializeAccountBlob(empty))).toEqual(empty);
  });

  it("round-trips a populated state (every field pinned, not just defaults)", () => {
    const populated: AccountBlob = {
      handle: "robin",
      aliases: [],
      state: {
        testing: {
          hasEverTested: true,
          lastPanelAgeDays: 12,
          corePanelComplete: true,
          exposedSitesCovered: true,
        },
        hiv: "positive_undetectable",
        activeNonHivSti: false,
        onPrep: true,
        condomPreference: "condoms_always",
        condomPreferencePublic: true,
        paused: false,
      },
    };
    expect(parseAccountBlob(serializeAccountBlob(populated))).toEqual(
      populated,
    );
  });

  const reject = (label: string, json: unknown) =>
    it(`rejects ${label}`, () => {
      expect(() =>
        parseAccountBlob(utf8ToBytes(JSON.stringify(json))),
      ).toThrow();
    });

  const S = INITIAL_OWNER_STATE;
  reject("a non-object", 7);
  reject("an unknown version", { v: 9, handle: "x", aliases: [], state: S });
  reject("an empty handle", { v: 2, handle: "", aliases: [], state: S });
  reject("a non-array aliases", { v: 2, handle: "x", aliases: {}, state: S });
  reject("an alias with a malformed id", {
    v: 2,
    handle: "x",
    aliases: [{ id: "short", writeToken: ID, key: ID, isPublic: true }],
    state: S,
  });
  reject("an alias missing isPublic", {
    v: 2,
    handle: "x",
    aliases: [{ id: ID, writeToken: ID, key: ID }],
    state: S,
  });
  reject("a missing state", { v: 2, handle: "x", aliases: [] });
  reject("an invalid hiv status", {
    v: 2,
    handle: "x",
    aliases: [],
    state: { ...S, hiv: "maybe" },
  });
});

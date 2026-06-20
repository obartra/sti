import { describe, it, expect } from "vitest";
import { serializeAccountBlob, parseAccountBlob } from "./accountBlob.ts";
import { utf8ToBytes } from "../crypto/index.ts";
import { INITIAL_OWNER_STATE } from "../core/badge.ts";
import { DEFAULT_AVATAR } from "../lib/avatars.ts";
import type { AccountBlob } from "./accountBlob.ts";

const ID = "A".repeat(43);
const blob: AccountBlob = {
  handle: "robin",
  aliases: [
    { id: ID, writeToken: "B".repeat(43), key: "C".repeat(43), isPublic: true },
  ],
  contacts: [
    {
      id: "D".repeat(43),
      label: "Sam",
      createdDay: 19_000,
      expiresDay: 19_007,
      alias: {
        id: "E".repeat(43),
        writeToken: "F".repeat(43),
        key: "G".repeat(43),
        isPublic: false,
      },
    },
  ],
  state: INITIAL_OWNER_STATE,
  avatar: DEFAULT_AVATAR,
  sharingMode: "link",
};

describe("account blob codec", () => {
  it("round-trips", () => {
    expect(parseAccountBlob(serializeAccountBlob(blob))).toEqual(blob);
  });

  it("round-trips an empty alias list", () => {
    const empty: AccountBlob = {
      handle: "sam",
      aliases: [],
      contacts: [],
      state: INITIAL_OWNER_STATE,
      avatar: DEFAULT_AVATAR,
      sharingMode: "public",
    };
    expect(parseAccountBlob(serializeAccountBlob(empty))).toEqual(empty);
  });

  it("round-trips a populated state and a customized avatar (every field pinned)", () => {
    const populated: AccountBlob = {
      handle: "robin",
      aliases: [],
      contacts: [],
      state: {
        testing: {
          lastPanelDay: 19_000,
          corePanelComplete: true,
          exposedSitesCovered: true,
        },
        hiv: "positive_undetectable",
        activeNonHivSti: false,
        onPrep: true,
        condomPreference: "condoms_always",
        condomPreferencePublic: true,
        onDoxyPep: false,
        paused: false,
        clearUntilDay: null,
      },
      avatar: { animal: 2, color: 3, hat: 1, glasses: 1, extra: 0 },
      sharingMode: "public",
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
  const A = DEFAULT_AVATAR;
  const base = {
    v: 5,
    handle: "x",
    aliases: [],
    contacts: [],
    state: S,
    avatar: A,
  };
  reject("a non-object", 7);
  reject("an unknown version", { ...base, v: 9 });
  reject("a prior version (v4 is no longer accepted)", {
    v: 4,
    handle: "x",
    aliases: [],
    state: S,
    avatar: A,
  });
  reject("a non-array contacts", {
    ...base,
    contacts: {},
    sharingMode: "link",
  });
  reject("a contact with a malformed alias", {
    ...base,
    contacts: [
      {
        id: ID,
        label: "x",
        createdDay: 1,
        expiresDay: null,
        alias: { id: "short" },
      },
    ],
    sharingMode: "link",
  });
  reject("an empty handle", { ...base, handle: "", sharingMode: "link" });
  reject("a non-array aliases", { ...base, aliases: {}, sharingMode: "link" });
  reject("an alias with a malformed id", {
    ...base,
    aliases: [{ id: "short", writeToken: ID, key: ID, isPublic: true }],
    sharingMode: "link",
  });
  reject("an alias missing isPublic", {
    ...base,
    aliases: [{ id: ID, writeToken: ID, key: ID }],
    sharingMode: "link",
  });
  reject("a missing state", {
    v: 5,
    handle: "x",
    aliases: [],
    contacts: [],
    avatar: A,
  });
  reject("an invalid hiv status", {
    ...base,
    state: { ...S, hiv: "maybe" },
    sharingMode: "link",
  });
  reject("a missing avatar", {
    v: 5,
    handle: "x",
    aliases: [],
    contacts: [],
    state: S,
    sharingMode: "link",
  });
  reject("an out-of-range avatar index", {
    ...base,
    avatar: { ...A, animal: 999 },
    sharingMode: "link",
  });
  reject("a non-integer avatar index", {
    ...base,
    avatar: { ...A, color: 1.5 },
    sharingMode: "link",
  });
  reject("a missing sharingMode", base);
  reject("an invalid sharingMode", { ...base, sharingMode: "secret" });
});

import { describe, it, expect } from "vitest";
import { serializeAccountBlob, parseAccountBlob } from "./accountBlob.ts";
import { utf8ToBytes, bytesToUtf8 } from "../crypto/index.ts";
import { INITIAL_OWNER_STATE } from "../core/badge.ts";
import { DEFAULT_AVATAR } from "../lib/avatars.ts";
import { mintNotify } from "./notifyInbox.ts";
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
      expiresAt: 19_007,
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

  it("round-trips the v6 notify capabilities (myNotify + a contact's theirNotify)", () => {
    const withNotify: AccountBlob = {
      handle: "robin",
      aliases: [],
      contacts: [
        {
          id: "D".repeat(43),
          label: "Sam",
          createdDay: 19_000,
          expiresAt: null,
          alias: {
            id: "E".repeat(43),
            writeToken: "F".repeat(43),
            key: "G".repeat(43),
            isPublic: false,
          },
          theirNotify: mintNotify(),
        },
      ],
      state: INITIAL_OWNER_STATE,
      avatar: DEFAULT_AVATAR,
      sharingMode: "link",
      myNotify: mintNotify(),
    };
    expect(parseAccountBlob(serializeAccountBlob(withNotify))).toEqual(
      withNotify,
    );
  });

  it("round-trips v7 circles (client-side bundles)", () => {
    const withCircles: AccountBlob = {
      handle: "robin",
      aliases: [],
      contacts: [],
      state: INITIAL_OWNER_STATE,
      avatar: DEFAULT_AVATAR,
      sharingMode: "link",
      circles: [
        {
          id: "H".repeat(43),
          name: "close",
          memberContactIds: ["D".repeat(43)],
        },
        { id: "I".repeat(43), name: "", memberContactIds: [] },
      ],
    };
    expect(parseAccountBlob(serializeAccountBlob(withCircles))).toEqual(
      withCircles,
    );
  });

  it("round-trips v9 per-alias display overrides (handle + avatar)", () => {
    const withOverride: AccountBlob = {
      handle: "robin",
      aliases: [
        {
          id: ID,
          writeToken: "B".repeat(43),
          key: "C".repeat(43),
          isPublic: true,
          handle: "meow",
          avatar: { hair: 1, mood: 2, skin: 2, hairColor: 4, beard: 0 },
        },
      ],
      contacts: [],
      state: INITIAL_OWNER_STATE,
      avatar: DEFAULT_AVATAR,
      sharingMode: "public",
    };
    expect(parseAccountBlob(serializeAccountBlob(withOverride))).toEqual(
      withOverride,
    );
  });

  it("round-trips a v10 alias link expiry (a day, and until-revoked)", () => {
    const withExpiry: AccountBlob = {
      handle: "robin",
      aliases: [
        {
          id: ID,
          writeToken: "B".repeat(43),
          key: "C".repeat(43),
          isPublic: true,
          expiresAt: 19_100,
        },
        {
          id: "D".repeat(43),
          writeToken: "E".repeat(43),
          key: "F".repeat(43),
          isPublic: false,
          expiresAt: null,
        },
      ],
      contacts: [],
      state: INITIAL_OWNER_STATE,
      avatar: DEFAULT_AVATAR,
      sharingMode: "link",
    };
    expect(parseAccountBlob(serializeAccountBlob(withExpiry))).toEqual(
      withExpiry,
    );
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
      avatar: { hair: 2, mood: 3, skin: 1, hairColor: 5, beard: 1 },
      sharingMode: "public",
    };
    expect(parseAccountBlob(serializeAccountBlob(populated))).toEqual(
      populated,
    );
  });

  it("round-trips a findable registration (doc 17)", () => {
    const withFindable: AccountBlob = {
      handle: "robin",
      aliases: [
        {
          id: "G".repeat(43),
          writeToken: "H".repeat(43),
          key: "I".repeat(43),
          isPublic: true,
        },
      ],
      contacts: [],
      state: INITIAL_OWNER_STATE,
      avatar: DEFAULT_AVATAR,
      sharingMode: "public",
      findable: { name: "robin", aliasId: "G".repeat(43) },
    };
    expect(parseAccountBlob(serializeAccountBlob(withFindable))).toEqual(
      withFindable,
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
  const N = mintNotify();
  const base = {
    v: 7,
    handle: "x",
    aliases: [],
    contacts: [],
    state: S,
    avatar: A,
  };
  reject("a non-object", 7);
  reject("an unknown version", { ...base, v: 12, sharingMode: "link" });
  reject("a prior version (v6 is no longer accepted)", {
    v: 6,
    handle: "x",
    aliases: [],
    contacts: [],
    state: S,
    avatar: A,
    sharingMode: "link",
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
        expiresAt: null,
        alias: { id: "short" },
      },
    ],
    sharingMode: "link",
  });
  // A real current-version wire so these reach the findable validator (not the
  // version gate, which `base`'s v7 trips first).
  const v11 = {
    v: 11,
    handle: "x",
    aliases: [],
    contacts: [],
    state: S,
    avatar: A,
    sharingMode: "link" as const,
  };
  reject("a findable with a malformed alias id", {
    ...v11,
    findable: { name: "robin", aliasId: "short" },
  });
  reject("a findable with a bad-shaped name", {
    ...v11,
    findable: { name: "AB", aliasId: ID },
  });
  reject("a findable that is not an object", { ...v11, findable: "robin" });
  reject("an empty handle", { ...base, handle: "", sharingMode: "link" });
  reject("a non-array aliases", { ...base, aliases: {}, sharingMode: "link" });
  reject("an alias with a malformed id", {
    ...base,
    aliases: [{ id: "short", writeToken: ID, key: ID, isPublic: true }],
    sharingMode: "link",
  });
  reject("an alias with a non-numeric expiry", {
    ...base,
    aliases: [
      { id: ID, writeToken: ID, key: ID, isPublic: true, expiresAt: "soon" },
    ],
    sharingMode: "link",
  });
  reject("an alias missing isPublic", {
    ...base,
    aliases: [{ id: ID, writeToken: ID, key: ID }],
    sharingMode: "link",
  });
  reject("an alias with an empty handle override", {
    ...base,
    aliases: [{ id: ID, writeToken: ID, key: ID, isPublic: true, handle: "" }],
    sharingMode: "link",
  });
  reject("a missing state", {
    v: 7,
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
  reject("a missing sharingMode", base);
  reject("an invalid sharingMode", { ...base, sharingMode: "secret" });
  reject("a malformed myNotify (missing routingToken)", {
    ...base,
    sharingMode: "link",
    myNotify: { inboxId: ID, writeToken: ID, key: ID },
  });
  reject("a contact theirNotify with a short token", {
    ...base,
    sharingMode: "link",
    contacts: [
      {
        id: ID,
        label: "x",
        createdDay: 1,
        expiresAt: null,
        alias: { id: ID, writeToken: ID, key: ID, isPublic: false },
        theirNotify: { ...N, routingToken: "short" },
      },
    ],
  });
  reject("a circle with a non-array members", {
    ...base,
    sharingMode: "link",
    circles: [{ id: ID, name: "x", memberContactIds: "nope" }],
  });
  reject("a circle with a malformed member id", {
    ...base,
    sharingMode: "link",
    circles: [{ id: ID, name: "x", memberContactIds: ["short"] }],
  });
});

describe("avatar migration on read (doc 19)", () => {
  // Build current-version wire from a valid blob, then mutate one field, so these
  // tests track the schema version automatically and exercise the real decoder.
  const wireOf = (b: AccountBlob): Record<string, unknown> =>
    JSON.parse(bytesToUtf8(serializeAccountBlob(b))) as Record<string, unknown>;
  const reparse = (wire: unknown): AccountBlob =>
    parseAccountBlob(utf8ToBytes(JSON.stringify(wire)));
  // The first alias of a freshly built wire, typed as a mutable record for the
  // override-mutation tests below.
  const firstAlias = (
    wire: Record<string, unknown>,
  ): Record<string, unknown> => {
    const aliases = wire.aliases as Record<string, unknown>[];
    const first = aliases[0];
    if (!first) throw new Error("test setup: expected one alias");
    return first;
  };

  const oneAlias: AccountBlob = {
    handle: "robin",
    aliases: [
      {
        id: ID,
        writeToken: "B".repeat(43),
        key: "C".repeat(43),
        isPublic: true,
        handle: "meow",
        avatar: DEFAULT_AVATAR,
        expiresAt: 19_100,
      },
    ],
    contacts: [
      {
        id: "D".repeat(43),
        label: "Sam",
        createdDay: 19_000,
        expiresAt: 19_007,
        alias: {
          id: "E".repeat(43),
          writeToken: "F".repeat(43),
          key: "G".repeat(43),
          isPublic: false,
          avatar: DEFAULT_AVATAR,
        },
      },
    ],
    state: INITIAL_OWNER_STATE,
    avatar: DEFAULT_AVATAR,
    sharingMode: "link",
  };

  for (const bad of [
    { animal: 2, color: 1, hat: 0, glasses: 0, extra: 0 }, // pre-doc-19 shape
    { hair: 99, mood: 0, tone: 0 }, // out of range
    { hair: 0, mood: 0 }, // partial
    "garbage",
    undefined,
  ]) {
    it(`coerces an invalid account avatar (${JSON.stringify(bad)}) to the default`, () => {
      const wire = wireOf(oneAlias);
      if (bad === undefined) delete wire.avatar;
      else wire.avatar = bad;
      expect(reparse(wire).avatar).toEqual(DEFAULT_AVATAR);
    });
  }

  it("drops an invalid alias avatar override but keeps every other field", () => {
    const wire = wireOf(oneAlias);
    firstAlias(wire).avatar = {
      animal: 1,
      color: 2,
      hat: 0,
      glasses: 1,
      extra: 0,
    };
    const alias = reparse(wire).aliases[0];
    expect(alias?.avatar).toBeUndefined();
    expect(alias?.handle).toBe("meow");
    expect(alias?.id).toBe(ID);
    // The rebuild must preserve link expiry, not just identity (doc 16).
    expect(alias?.expiresAt).toBe(19_100);
  });

  it("keeps a valid alias avatar override untouched", () => {
    const override = { hair: 3, mood: 1, skin: 0, hairColor: 5, beard: 0 };
    const wire = wireOf(oneAlias);
    firstAlias(wire).avatar = override;
    expect(reparse(wire).aliases[0]?.avatar).toEqual(override);
  });

  it("migrates a contact link's alias avatar too, keeping the contact intact", () => {
    const wire = wireOf(oneAlias);
    const contacts = wire.contacts as Record<string, unknown>[];
    const contact = contacts[0];
    if (!contact) throw new Error("test setup: expected one contact");
    (contact.alias as Record<string, unknown>).avatar = {
      animal: 2, // pre-doc-19 shape on a per-contact alias
      color: 1,
      hat: 0,
      glasses: 0,
      extra: 0,
    };
    const parsed = reparse(wire).contacts[0];
    expect(parsed?.alias.avatar).toBeUndefined();
    expect(parsed?.label).toBe("Sam");
    expect(parsed?.expiresAt).toBe(19_007);
  });
});

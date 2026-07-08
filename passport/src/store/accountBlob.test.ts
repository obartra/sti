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
};

describe("account blob codec", () => {
  it("round-trips", () => {
    expect(parseAccountBlob(serializeAccountBlob(blob))).toEqual(blob);
  });

  it("round-trips the Home default-view preference and drops a bad one", () => {
    const withPref: AccountBlob = { ...blob, homeDefaultView: "shared" };
    expect(parseAccountBlob(serializeAccountBlob(withPref))).toEqual(withPref);
    // A blob written without the field stays valid and absent (defaults later).
    expect(parseAccountBlob(serializeAccountBlob(blob)).homeDefaultView).toBe(
      undefined,
    );
    // A bad value fails the strict parse rather than silently defaulting (build it
    // from a real serialize so the schema version is whatever the codec emits).
    const wire = JSON.parse(bytesToUtf8(serializeAccountBlob(blob))) as Record<
      string,
      unknown
    >;
    wire.homeDefaultView = "sideways";
    expect(() =>
      parseAccountBlob(new TextEncoder().encode(JSON.stringify(wire))),
    ).toThrow();
  });

  it("never serializes a real-name field anywhere in the blob (G11)", () => {
    // The blob carries a self-chosen `handle`, never a legal/first/last name. A
    // future blob field called `name` (or firstname/lastname/legal) would be a PII
    // leak, so this fails on any such key recursively (the contact's nested alias
    // and notify objects included).
    const json = bytesToUtf8(serializeAccountBlob(blob));
    const parsed: unknown = JSON.parse(json);
    const NAMEY = /name|firstname|lastname|legal/i;
    const walk = (v: unknown, path: string): void => {
      if (Array.isArray(v)) {
        v.forEach((x, i) => walk(x, `${path}[${i}]`));
      } else if (v !== null && typeof v === "object") {
        for (const [k, val] of Object.entries(v)) {
          expect(NAMEY.test(k), `forbidden name-like key at ${path}.${k}`).toBe(
            false,
          );
          walk(val, `${path}.${k}`);
        }
      }
    };
    walk(parsed, "blob");
  });

  it("round-trips a contact's per-contact notify capabilities (myInbox + theirNotify)", () => {
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
          myInbox: mintNotify(),
          theirNotify: mintNotify(),
        },
      ],
      state: INITIAL_OWNER_STATE,
      avatar: DEFAULT_AVATAR,
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
    };
    expect(parseAccountBlob(serializeAccountBlob(populated))).toEqual(
      populated,
    );
  });

  it("round-trips findable registrations (doc 17)", () => {
    const withFindables: AccountBlob = {
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
      findables: [
        { name: "robin", aliasId: "G".repeat(43) },
        { name: "wren", aliasId: "J".repeat(43) },
      ],
    };
    expect(parseAccountBlob(serializeAccountBlob(withFindables))).toEqual(
      withFindables,
    );
  });

  it("parses a findables list past the cap of 5 (the cap is a claim-time rule)", () => {
    // A rare offline multi-device merge can union past MAX_PUBLIC_NAMES; that is a
    // valid blob (the cap is enforced at claim, not at storage) and must still parse.
    const findables = Array.from({ length: 6 }, (_, i) => ({
      name: `name_${i}`,
      aliasId: String.fromCharCode(65 + i).repeat(43),
    }));
    const overCap: AccountBlob = {
      handle: "robin",
      aliases: [],
      contacts: [],
      state: INITIAL_OWNER_STATE,
      avatar: DEFAULT_AVATAR,
      findables,
    };
    expect(
      parseAccountBlob(serializeAccountBlob(overCap)).findables,
    ).toHaveLength(6);
  });

  it("round-trips v16 shared groups (public + private) (doc 33)", () => {
    const withGroups: AccountBlob = {
      ...blob,
      groups: [
        {
          groupId: "G".repeat(43),
          groupWriteToken: "H".repeat(43),
          kg: "I".repeat(43),
          myCardId: "J".repeat(43),
          myCardWriteToken: "K".repeat(43),
          handle: "book_club",
          visibility: "public",
          meetingKind: "recurring",
          isAdmin: true,
          joinPointerId: "L".repeat(43),
          joinWriteToken: "M".repeat(43),
        },
        {
          groupId: "N".repeat(43),
          groupWriteToken: "O".repeat(43),
          kg: "P".repeat(43),
          myCardId: "Q".repeat(43),
          myCardWriteToken: "R".repeat(43),
          handle: "party_2026",
          visibility: "private",
          meetingKind: "event",
          isAdmin: true,
        },
      ],
    };
    expect(parseAccountBlob(serializeAccountBlob(withGroups))).toEqual(
      withGroups,
    );
    // A blob written without groups stays valid and absent.
    expect(parseAccountBlob(serializeAccountBlob(blob)).groups).toBeUndefined();
  });

  it("round-trips v17 admin group members + pending invites (doc 33)", () => {
    const inbox = {
      inboxId: "S".repeat(43),
      writeToken: "T".repeat(43),
      key: "U".repeat(43),
    };
    const withMembers: AccountBlob = {
      ...blob,
      groups: [
        {
          groupId: "G".repeat(43),
          groupWriteToken: "H".repeat(43),
          kg: "I".repeat(43),
          myCardId: "J".repeat(43),
          myCardWriteToken: "K".repeat(43),
          handle: "book_club",
          visibility: "public",
          meetingKind: "recurring",
          isAdmin: true,
          members: [
            {
              cardId: "V".repeat(43),
              memberKey: "W".repeat(43),
              lifecycleInbox: inbox,
            },
          ],
          pendingInvites: [
            {
              inviteId: "X".repeat(43),
              lifecycleInbox: inbox,
              createdDay: 19_000,
              label: "Sam",
            },
          ],
        },
      ],
    };
    expect(parseAccountBlob(serializeAccountBlob(withMembers))).toEqual(
      withMembers,
    );
  });

  it("round-trips a v17 member group (no write token, no Kg, a lifecycle inbox) (doc 33)", () => {
    const inbox = {
      inboxId: "S".repeat(43),
      writeToken: "T".repeat(43),
      key: "U".repeat(43),
    };
    const asMember: AccountBlob = {
      ...blob,
      groups: [
        {
          groupId: "G".repeat(43),
          myCardId: "J".repeat(43),
          myCardWriteToken: "K".repeat(43),
          handle: "book_club",
          visibility: "private",
          meetingKind: "event",
          isAdmin: false,
          lifecycleInbox: inbox,
        },
      ],
    };
    expect(parseAccountBlob(serializeAccountBlob(asMember))).toEqual(asMember);
  });

  it("round-trips a v18 group shown face (myHandle + myAvatar) (doc 33)", () => {
    const shown: AccountBlob = {
      ...blob,
      groups: [
        {
          groupId: "G".repeat(43),
          groupWriteToken: "W".repeat(43),
          kg: "K".repeat(43),
          myCardId: "J".repeat(43),
          myCardWriteToken: "L".repeat(43),
          handle: "book_club",
          visibility: "private",
          meetingKind: "event",
          isAdmin: true,
          myHandle: "robin",
          myAvatar: DEFAULT_AVATAR,
        },
      ],
    };
    expect(parseAccountBlob(serializeAccountBlob(shown))).toEqual(shown);
  });

  it("drops a bad group shown-face avatar on read, keeping the rest (doc 19)", () => {
    // A group record whose myAvatar is an old/corrupt shape: parse must drop just
    // the avatar (fall back to id-derived), never invalidate the whole account.
    const wire = {
      v: 21,
      handle: "robin",
      aliases: [],
      contacts: [],
      state: INITIAL_OWNER_STATE,
      avatar: DEFAULT_AVATAR,
      groups: [
        {
          groupId: "G".repeat(43),
          groupWriteToken: "W".repeat(43),
          kg: "K".repeat(43),
          myCardId: "J".repeat(43),
          myCardWriteToken: "L".repeat(43),
          handle: "book_club",
          visibility: "private",
          meetingKind: "event",
          isAdmin: true,
          myHandle: "robin",
          myAvatar: { not: "a valid avatar" },
        },
      ],
    };
    const parsed = parseAccountBlob(utf8ToBytes(JSON.stringify(wire)));
    const group = parsed.groups?.[0];
    expect(group?.myHandle).toBe("robin");
    expect(group?.myAvatar).toBeUndefined();
  });

  it("round-trips a v14 stored recovery phrase (doc 32)", () => {
    // A well-formed 43-char app phrase (base64url, no padding).
    const phrase = "abcdefghijklmnopqrstuvwxyz0123456789-_ABCDE";
    expect(phrase).toHaveLength(43);
    const withPhrase: AccountBlob = { ...blob, recoveryPhrase: phrase };
    expect(parseAccountBlob(serializeAccountBlob(withPhrase))).toEqual(
      withPhrase,
    );
    // A blob written without the phrase stays valid and absent (the passkey-only
    // account: Settings shows the sign-in fallback rather than erroring).
    expect(
      parseAccountBlob(serializeAccountBlob(blob)).recoveryPhrase,
    ).toBeUndefined();
  });

  it("round-trips a v15 password set/changed timestamp (doc 32)", () => {
    const withSetAt: AccountBlob = {
      ...blob,
      recoveryName: "robin",
      passwordSetAt: 1_700_000_000_000,
    };
    expect(parseAccountBlob(serializeAccountBlob(withSetAt))).toEqual(
      withSetAt,
    );
    // A blob written without it stays valid and absent (no password, or a password
    // that predates the field: the nudge treats a missing value as not yet due).
    expect(
      parseAccountBlob(serializeAccountBlob(blob)).passwordSetAt,
    ).toBeUndefined();
    // Zero is a valid (non-negative, finite) instant and round-trips.
    const atZero: AccountBlob = { ...blob, passwordSetAt: 0 };
    expect(parseAccountBlob(serializeAccountBlob(atZero)).passwordSetAt).toBe(
      0,
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
  reject("an unknown version", { ...base, v: 22 });
  reject("a prior version (v6 is no longer accepted)", {
    v: 6,
    handle: "x",
    aliases: [],
    contacts: [],
    state: S,
    avatar: A,
  });
  reject("a non-array contacts", {
    ...base,
    contacts: {},
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
  });
  // A real current-version wire so these reach the findables validator (not the
  // version gate, which `base`'s v7 trips first).
  const vCurrent = {
    v: 21,
    handle: "x",
    aliases: [],
    contacts: [],
    state: S,
    avatar: A,
  };
  reject("a findable with a malformed alias id", {
    ...vCurrent,
    findables: [{ name: "robin", aliasId: "short" }],
  });
  reject("a findable with a bad-shaped name", {
    ...vCurrent,
    findables: [{ name: "AB", aliasId: ID }],
  });
  reject("a findable that is not an object", {
    ...vCurrent,
    findables: ["robin"],
  });
  reject("findables that is not an array", {
    ...vCurrent,
    findables: { name: "robin", aliasId: ID },
  });
  // The stored recovery phrase must be an exact app phrase; a too-short or
  // wrong-charset value fails the parse rather than surfacing a broken phrase.
  reject("a recovery phrase that is too short", {
    ...vCurrent,
    recoveryPhrase: "too-short",
  });
  reject("a recovery phrase with a bad character", {
    ...vCurrent,
    recoveryPhrase: `!${"A".repeat(42)}`,
  });
  // passwordSetAt must be a non-negative finite number when present (doc 32): a
  // negative or non-number value fails the parse rather than mis-timing the yearly
  // nudge. (NaN/Infinity cannot survive JSON, so null stands in for "not a number".)
  reject("a negative passwordSetAt", { ...vCurrent, passwordSetAt: -1 });
  reject("a null passwordSetAt", { ...vCurrent, passwordSetAt: null });
  reject("a non-number passwordSetAt", { ...vCurrent, passwordSetAt: "soon" });
  reject("an empty handle", { ...base, handle: "" });
  reject("a non-array aliases", { ...base, aliases: {} });
  reject("an alias with a malformed id", {
    ...base,
    aliases: [{ id: "short", writeToken: ID, key: ID, isPublic: true }],
  });
  reject("an alias with a non-numeric expiry", {
    ...base,
    aliases: [
      { id: ID, writeToken: ID, key: ID, isPublic: true, expiresAt: "soon" },
    ],
  });
  reject("an alias missing isPublic", {
    ...base,
    aliases: [{ id: ID, writeToken: ID, key: ID }],
  });
  reject("an alias with an empty handle override", {
    ...base,
    aliases: [{ id: ID, writeToken: ID, key: ID, isPublic: true, handle: "" }],
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
  });
  // A current-version wire (vCurrent) so these reach the contact validator rather
  // than the version gate that base's v7 trips first.
  const contactWith = (extra: Record<string, unknown>) => ({
    ...vCurrent,
    contacts: [
      {
        id: ID,
        label: "x",
        createdDay: 1,
        expiresAt: null,
        alias: { id: ID, writeToken: ID, key: ID, isPublic: false },
        ...extra,
      },
    ],
  });
  reject(
    "a contact myInbox missing routingToken",
    contactWith({ myInbox: { inboxId: ID, writeToken: ID, key: ID } }),
  );
  reject(
    "a contact myInbox with a short token",
    contactWith({ myInbox: { ...N, inboxId: "short" } }),
  );
  reject(
    "a contact theirNotify with a short token",
    contactWith({ theirNotify: { ...N, routingToken: "short" } }),
  );
  reject("a circle with a non-array members", {
    ...base,
    circles: [{ id: ID, name: "x", memberContactIds: "nope" }],
  });
  reject("a circle with a malformed member id", {
    ...base,
    circles: [{ id: ID, name: "x", memberContactIds: ["short"] }],
  });
  // A group record: every capability id-shaped, handle well-shaped, visibility and
  // meetingKind in their sets. These reach the group validator via vCurrent.
  const groupOk = {
    groupId: ID,
    groupWriteToken: ID,
    kg: ID,
    myCardId: ID,
    myCardWriteToken: ID,
    handle: "book_club",
    visibility: "public" as const,
    meetingKind: "recurring" as const,
    isAdmin: true,
  };
  reject("a group with a malformed groupId", {
    ...vCurrent,
    groups: [{ ...groupOk, groupId: "short" }],
  });
  reject("a group with a malformed kg", {
    ...vCurrent,
    groups: [{ ...groupOk, kg: "short" }],
  });
  reject("a group with a bad-shaped handle", {
    ...vCurrent,
    groups: [{ ...groupOk, handle: "AB" }],
  });
  reject("a group with an invalid visibility", {
    ...vCurrent,
    groups: [{ ...groupOk, visibility: "secret" }],
  });
  reject("a group with an invalid meetingKind", {
    ...vCurrent,
    groups: [{ ...groupOk, meetingKind: "sometimes" }],
  });
  reject("a group with a malformed joinPointerId", {
    ...vCurrent,
    groups: [{ ...groupOk, joinPointerId: "short" }],
  });
  reject("a non-array groups", { ...vCurrent, groups: {} });
  // v17 (doc 33, slice 4a): an admin record must carry the write token and Kg; the
  // member/invite sub-objects are strictly shaped.
  reject("an admin group missing its write token", {
    ...vCurrent,
    groups: [{ ...groupOk, groupWriteToken: undefined }],
  });
  reject("an admin group missing its Kg", {
    ...vCurrent,
    groups: [{ ...groupOk, kg: undefined }],
  });
  const inboxOk = { inboxId: ID, writeToken: ID, key: ID };
  reject("a group member secret with a malformed memberKey", {
    ...vCurrent,
    groups: [
      {
        ...groupOk,
        members: [{ cardId: ID, memberKey: "short", lifecycleInbox: inboxOk }],
      },
    ],
  });
  reject("a group member secret with a malformed lifecycle inbox", {
    ...vCurrent,
    groups: [
      {
        ...groupOk,
        members: [
          { cardId: ID, memberKey: ID, lifecycleInbox: { inboxId: ID } },
        ],
      },
    ],
  });
  reject("a pending invite with a negative createdDay", {
    ...vCurrent,
    groups: [
      {
        ...groupOk,
        pendingInvites: [
          { inviteId: ID, lifecycleInbox: inboxOk, createdDay: -1 },
        ],
      },
    ],
  });
});

describe("v17 member group validity (doc 33)", () => {
  it("accepts a member group without a write token or Kg but rejects an admin one", () => {
    const inbox = {
      inboxId: "A".repeat(43),
      writeToken: "B".repeat(43),
      key: "C".repeat(43),
    };
    const memberGroup = {
      groupId: "G".repeat(43),
      myCardId: "J".repeat(43),
      myCardWriteToken: "K".repeat(43),
      handle: "book_club",
      visibility: "private" as const,
      meetingKind: "event" as const,
      isAdmin: false,
      lifecycleInbox: inbox,
    };
    const asMember: AccountBlob = { ...blob, groups: [memberGroup] };
    // Valid as a member (no groupWriteToken, no kg).
    expect(parseAccountBlob(serializeAccountBlob(asMember))).toEqual(asMember);
    // The SAME record flagged admin is invalid: an admin must hold both.
    const wire = JSON.parse(
      bytesToUtf8(serializeAccountBlob(asMember)),
    ) as Record<string, unknown>;
    const firstGroup = (wire.groups as Record<string, unknown>[])[0];
    if (firstGroup === undefined) throw new Error("expected a group");
    firstGroup.isAdmin = true;
    expect(() => parseAccountBlob(utf8ToBytes(JSON.stringify(wire)))).toThrow();
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

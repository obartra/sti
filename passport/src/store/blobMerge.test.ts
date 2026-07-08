import { describe, it, expect } from "vitest";
import { INITIAL_OWNER_STATE } from "../core/badge.ts";
import { DEFAULT_AVATAR } from "../lib/avatars.ts";
import type {
  AccountBlob,
  AliasRecord,
  ContactRecord,
  GroupRecord,
} from "./accountBlob.ts";
import { mergeAccountBlobs, deepEqual } from "./blobMerge.ts";

function alias(id: string): AliasRecord {
  return { id, writeToken: `wt-${id}`, key: `k-${id}`, isPublic: false };
}
function contact(id: string, label = id): ContactRecord {
  return {
    id,
    label,
    createdDay: 100,
    expiresAt: null,
    alias: alias(`a-${id}`),
  };
}

const BASE: AccountBlob = {
  handle: "robin",
  aliases: [alias("x")],
  contacts: [contact("c1")],
  state: INITIAL_OWNER_STATE,
  avatar: DEFAULT_AVATAR,
};

describe("deepEqual", () => {
  it("compares nested structures by value, ignoring key order", () => {
    expect(deepEqual({ a: 1, b: { c: 2 } }, { b: { c: 2 }, a: 1 })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(deepEqual([1, 2], [1, 2])).toBe(true);
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
    expect(deepEqual({ a: undefined }, {})).toBe(false); // a different shape
  });
});

describe("mergeAccountBlobs (doc 22 S8, 3-way)", () => {
  it("keeps both sides' edits when they touch different fields", () => {
    // I changed my state; they added a contact. Neither edit should revert.
    const mine: AccountBlob = {
      ...BASE,
      state: { ...INITIAL_OWNER_STATE, paused: true },
    };
    const theirs: AccountBlob = {
      ...BASE,
      contacts: [contact("c1"), contact("c2")],
    };

    const merged = mergeAccountBlobs(BASE, mine, theirs);
    expect(merged.state.paused).toBe(true); // my change survived
    expect(merged.contacts.map((c) => c.id).sort()).toEqual(["c1", "c2"]); // theirs too
  });

  it("a record I added and a record they added both survive", () => {
    const mine: AccountBlob = {
      ...BASE,
      contacts: [contact("c1"), contact("mine")],
    };
    const theirs: AccountBlob = {
      ...BASE,
      contacts: [contact("c1"), contact("theirs")],
    };
    const merged = mergeAccountBlobs(BASE, mine, theirs);
    expect(merged.contacts.map((c) => c.id).sort()).toEqual([
      "c1",
      "mine",
      "theirs",
    ]);
  });

  it("same id added on both sides with differing fields: mine wins (no ancestor)", () => {
    // Both devices independently created a record under the same id while offline,
    // with different labels. There is no ancestor for it, so it is a true divergence
    // and the active device (mine) wins, matching the same-field policy.
    const mine: AccountBlob = {
      ...BASE,
      contacts: [contact("c1"), contact("dup", "mine")],
    };
    const theirs: AccountBlob = {
      ...BASE,
      contacts: [contact("c1"), contact("dup", "theirs")],
    };
    const merged = mergeAccountBlobs(BASE, mine, theirs);
    expect(merged.contacts.find((c) => c.id === "dup")?.label).toBe("mine");
  });

  it("delete wins: a contact I revoked stays gone even if they edited it", () => {
    // I removed c1; they relabeled it. Revocation must not be resurrected.
    const mine: AccountBlob = { ...BASE, contacts: [] };
    const theirs: AccountBlob = {
      ...BASE,
      contacts: [contact("c1", "renamed")],
    };
    const merged = mergeAccountBlobs(BASE, mine, theirs);
    expect(merged.contacts).toEqual([]);
  });

  it("delete wins symmetrically: a contact they revoked stays gone", () => {
    const mine: AccountBlob = { ...BASE, contacts: [contact("c1", "renamed")] };
    const theirs: AccountBlob = { ...BASE, contacts: [] };
    const merged = mergeAccountBlobs(BASE, mine, theirs);
    expect(merged.contacts).toEqual([]);
  });

  it("reconciles a record present on both sides: an enrichment from one side is kept", () => {
    // They completed the exchange (filled theirStatusAlias); I left c1 untouched.
    const enriched: ContactRecord = {
      ...contact("c1"),
      theirStatusAlias: { id: "their-alias", key: "their-key" },
    };
    const mine: AccountBlob = BASE; // unchanged
    const theirs: AccountBlob = { ...BASE, contacts: [enriched] };
    const merged = mergeAccountBlobs(BASE, mine, theirs);
    expect(merged.contacts[0]).toEqual(enriched); // I didn't touch it, so theirs wins
  });

  it("on a true same-field divergence, mine wins (the active device)", () => {
    const mine: AccountBlob = { ...BASE, handle: "mine" };
    const theirs: AccountBlob = { ...BASE, handle: "theirs" };
    expect(mergeAccountBlobs(BASE, mine, theirs).handle).toBe("mine");
  });

  it("takes their scalar change when I left the field untouched", () => {
    const mine: AccountBlob = BASE; // handle unchanged
    const theirs: AccountBlob = { ...BASE, handle: "wren" };
    expect(mergeAccountBlobs(BASE, mine, theirs).handle).toBe("wren");
  });

  it("merges circles and omits the field when the result is empty", () => {
    const withCircle: AccountBlob = {
      ...BASE,
      circles: [{ id: "g1", name: "ride", memberContactIds: ["c1"] }],
    };
    // They added a circle; I had none. The added circle survives.
    const merged = mergeAccountBlobs(BASE, BASE, withCircle);
    expect(merged.circles).toEqual(withCircle.circles);

    // Both sides cleared circles back to none: the field is omitted entirely.
    const noCircles = mergeAccountBlobs(withCircle, BASE, BASE);
    expect("circles" in noCircles).toBe(false);
  });

  it("merges findables by name: two different offline claims both survive", () => {
    const robin = { name: "robin", aliasId: "x" };
    const wren = { name: "wren", aliasId: "y" };
    // Each device claimed a DIFFERENT name offline (neither in the ancestor): both
    // adds survive, merged by name.
    const mine: AccountBlob = { ...BASE, findables: [robin] };
    const theirs: AccountBlob = { ...BASE, findables: [wren] };
    const merged = mergeAccountBlobs(BASE, mine, theirs);
    expect(merged.findables).toEqual(expect.arrayContaining([robin, wren]));
    expect(merged.findables).toHaveLength(2);
  });

  it("merges findables: a name deleted on one side stays deleted (delete wins)", () => {
    const robin = { name: "robin", aliasId: "x" };
    const wren = { name: "wren", aliasId: "y" };
    const base: AccountBlob = { ...BASE, findables: [robin, wren] };
    // They released "robin"; I left the list untouched: the release is taken.
    const theirs: AccountBlob = { ...BASE, findables: [wren] };
    const merged = mergeAccountBlobs(base, base, theirs);
    expect(merged.findables).toEqual([wren]);

    // Both sides dropped every name back to none: the field is omitted entirely.
    const emptied = mergeAccountBlobs(base, BASE, BASE);
    expect("findables" in emptied).toBe(false);
  });

  // Regression: the merge REBUILDS the blob, and its field list once lagged the
  // schema, so a 409 resolution silently dropped groups (an admin's Kg + write
  // tokens, unrecoverable) and the recovery fields. These pin every such field
  // through an unrelated conflict merge; MERGED_FIELDS in blobMerge.ts makes the
  // next lag a compile error.
  it("groups survive an unrelated conflict merge, on either side", () => {
    const g = (groupId: string): GroupRecord => ({
      groupId,
      groupWriteToken: "w",
      kg: "k",
      myCardId: `${groupId}-card`,
      myCardWriteToken: "w",
      handle: "book_club",
      visibility: "private",
      meetingKind: "event",
      isAdmin: true,
    });
    // I hold a group; they concurrently changed the handle: the group survives.
    const mine: AccountBlob = { ...BASE, groups: [g("g1")] };
    const theirs: AccountBlob = { ...BASE, handle: "wren" };
    const merged = mergeAccountBlobs(BASE, mine, theirs);
    expect(merged.groups?.map((x) => x.groupId)).toEqual(["g1"]);
    expect(merged.handle).toBe("wren");

    // A group joined on the OTHER device arrives here through the merge.
    const fromTheirs = mergeAccountBlobs(BASE, BASE, {
      ...BASE,
      groups: [g("g2")],
    });
    expect(fromTheirs.groups?.map((x) => x.groupId)).toEqual(["g2"]);

    // Delete wins: a group I left while offline stays gone despite their edit
    // to it (a resurrected admin record would revive dead capabilities).
    const withGroup: AccountBlob = { ...BASE, groups: [g("g1")] };
    const left = mergeAccountBlobs(withGroup, BASE, withGroup);
    expect("groups" in left).toBe(false);
  });

  it("recovery fields and the home view preference survive a conflict merge", () => {
    const mine: AccountBlob = {
      ...BASE,
      homeDefaultView: "shared",
      recoveryName: "robin",
      recoveryPhrase: "abcdefghijklmnopqrstuvwxyz0123456789-_ABCDE",
      passwordSetAt: 1_700_000_000_000,
    };
    const theirs: AccountBlob = {
      ...BASE,
      contacts: [contact("c1"), contact("c2")],
    };
    const merged = mergeAccountBlobs(BASE, mine, theirs);
    expect(merged.homeDefaultView).toBe("shared");
    expect(merged.recoveryName).toBe("robin");
    expect(merged.recoveryPhrase).toBe(mine.recoveryPhrase);
    expect(merged.passwordSetAt).toBe(1_700_000_000_000);
    expect(merged.contacts.map((c) => c.id).sort()).toEqual(["c1", "c2"]);
    // Absent on both sides stays omitted, matching serializeAccountBlob.
    const untouched = mergeAccountBlobs(BASE, BASE, BASE);
    expect("recoveryPhrase" in untouched).toBe(false);
  });

  it("is a no-op when neither side diverged from the ancestor", () => {
    expect(mergeAccountBlobs(BASE, BASE, BASE)).toEqual(BASE);
  });
});

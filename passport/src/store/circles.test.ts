// @vitest-environment node
import { describe, it, expect } from "vitest";
import { normalizeCircleMembers, resolveCircleRoster } from "./circles.ts";
import type { AccountBlob, ContactRecord } from "./accountBlob.ts";
import type { ResolvedView } from "../ui/public/PublicResolution.tsx";
import type { PassportStore } from "./passportStore.ts";
import { INITIAL_OWNER_STATE } from "../core/badge.ts";
import { DEFAULT_AVATAR } from "../lib/avatars.ts";

function members(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `c${i}`);
}

// A blob whose contacts are exactly the given ids (only .id matters here).
function blobWithContacts(ids: string[]): AccountBlob {
  const contacts = ids.map(
    (id): ContactRecord => ({
      id,
      label: "",
      createdDay: 1,
      expiresAt: null,
      alias: { id, writeToken: id, key: id, isPublic: false },
    }),
  );
  return {
    handle: "robin",
    aliases: [],
    contacts,
    state: INITIAL_OWNER_STATE,
    avatar: DEFAULT_AVATAR,
    sharingMode: "link",
  };
}

// A contact whose read-only status alias id equals `statusId` (or none if null),
// so the fake resolver below can map that id to a blue/gray/missing card.
function contactWithStatus(
  id: string,
  statusId: string | null,
  label = id,
): ContactRecord {
  const base: ContactRecord = {
    id,
    label,
    createdDay: 1,
    expiresAt: null,
    alias: { id, writeToken: id, key: id, isPublic: false },
  };
  if (statusId === null) return base;
  return { ...base, theirStatusAlias: { id: statusId, key: "k" } };
}

// A resolver mapping alias id -> a blue card; everything else resolves to the
// uniform null (unreachable / no status / not in the map), per the store contract.
function blueResolver(blueIds: string[]): PassportStore["resolveAlias"] {
  const blue = new Set(blueIds);
  return ({ id }) => {
    const view: ResolvedView = { state: "blue", identity: { handle: "x" } };
    return Promise.resolve(blue.has(id) ? view : null);
  };
}

describe("resolveCircleRoster", () => {
  it("shows the roster at any size, including a tiny group (no hide floor)", async () => {
    // Two members: being in the group is itself sharing your color (doc 31), so the
    // roster resolves rather than hiding the way the old min-5 floor did.
    const ids = members(2);
    const circle = { id: "c", name: "n", memberContactIds: ids };
    const contacts = ids.map((id) => contactWithStatus(id, `s-${id}`));
    const roster = await resolveCircleRoster(
      circle,
      contacts,
      blueResolver(["s-c0"]),
    );
    expect(roster.map((m) => m.contactId)).toEqual(ids);
    expect(roster.map((m) => m.tone)).toEqual(["blue", "gray"]);
  });

  it("is blue only when a member's status currently resolves blue, gray otherwise", async () => {
    const ids = members(5); // c0..c4
    const contacts = [
      contactWithStatus("c0", "s-c0"), // resolves blue
      contactWithStatus("c1", "s-c1"), // resolves null -> gray
      contactWithStatus("c2", null), // no status alias -> gray
      contactWithStatus("c3", "s-c3"), // resolves blue
      contactWithStatus("c4", "s-c4"), // resolves null -> gray
    ];
    const circle = { id: "c", name: "n", memberContactIds: ids };
    const roster = await resolveCircleRoster(
      circle,
      contacts,
      blueResolver(["s-c0", "s-c3"]),
    );
    // Count and order always match membership; tone is per resolved status.
    expect(roster.map((m) => m.tone)).toEqual([
      "blue",
      "gray",
      "gray",
      "blue",
      "gray",
    ]);
    expect(roster.map((m) => m.contactId)).toEqual(ids);
  });

  it("is fail-closed: a member whose resolve throws reads gray, never errors the roster", async () => {
    const ids = members(5);
    const contacts = ids.map((id) => contactWithStatus(id, `s-${id}`));
    const circle = { id: "c", name: "n", memberContactIds: ids };
    // c2's resolve rejects (unreachable); the rest resolve blue.
    const resolver: PassportStore["resolveAlias"] = ({ id }) => {
      if (id === "s-c2") return Promise.reject(new Error("unreachable"));
      const view: ResolvedView = { state: "blue", identity: { handle: "x" } };
      return Promise.resolve(view);
    };
    const roster = await resolveCircleRoster(circle, contacts, resolver);
    expect(roster.map((m) => m.tone)).toEqual([
      "blue",
      "blue",
      "gray",
      "blue",
      "blue",
    ]);
  });

  it("carries the owner's private label for each member", async () => {
    const ids = members(5);
    const contacts = ids.map((id, i) =>
      contactWithStatus(id, null, `nick-${i}`),
    );
    const circle = { id: "c", name: "n", memberContactIds: ids };
    const roster = await resolveCircleRoster(
      circle,
      contacts,
      blueResolver([]),
    );
    expect(roster.map((m) => m.label)).toEqual(ids.map((_, i) => `nick-${i}`));
  });
});

describe("normalizeCircleMembers", () => {
  it("drops ids that are not current contacts", () => {
    const blob = blobWithContacts(["a", "b"]);
    expect(normalizeCircleMembers(blob, ["a", "ghost", "b"])).toEqual([
      "a",
      "b",
    ]);
  });

  it("dedupes while preserving first-seen order", () => {
    const blob = blobWithContacts(["a", "b", "c"]);
    expect(normalizeCircleMembers(blob, ["c", "a", "c", "b", "a"])).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it("returns an empty list when no proposed member is a contact", () => {
    const blob = blobWithContacts(["a"]);
    expect(normalizeCircleMembers(blob, ["x", "y"])).toEqual([]);
  });
});

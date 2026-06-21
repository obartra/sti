// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  MIN_CIRCLE_SIZE,
  circleMeetsFloor,
  visibleCircleStatuses,
  normalizeCircleMembers,
} from "./circles.ts";
import type {
  AccountBlob,
  CircleRecord,
  ContactRecord,
} from "./accountBlob.ts";
import { INITIAL_OWNER_STATE } from "../core/badge.ts";
import { DEFAULT_AVATAR } from "../lib/avatars.ts";

function circle(memberContactIds: string[]): CircleRecord {
  return { id: "circle-1", name: "close", memberContactIds };
}

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
      expiresDay: null,
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

describe("min-group-5 hide floor", () => {
  it("a circle below five members does not meet the floor", () => {
    expect(circleMeetsFloor(circle(members(MIN_CIRCLE_SIZE - 1)))).toBe(false);
    expect(circleMeetsFloor(circle(members(MIN_CIRCLE_SIZE)))).toBe(true);
  });

  it("hides ALL statuses below the floor (never a partial reveal)", () => {
    const statuses = new Map(members(4).map((id) => [id, `status-${id}`]));
    expect(visibleCircleStatuses(circle(members(4)), statuses)).toBeNull();
  });

  it("shows member statuses in membership order at or above the floor", () => {
    const ids = members(5);
    const statuses = new Map(ids.map((id) => [id, `status-${id}`]));
    expect(visibleCircleStatuses(circle(ids), statuses)).toEqual(
      ids.map((id) => `status-${id}`),
    );
  });

  it("omits members with no resolved status without leaking who is missing", () => {
    const ids = members(5);
    // Drop one member's status: it is simply absent, no placeholder.
    const statuses = new Map(
      ids.filter((id) => id !== "c2").map((id) => [id, `status-${id}`]),
    );
    const visible = visibleCircleStatuses(circle(ids), statuses);
    expect(visible).toEqual(
      ids.filter((id) => id !== "c2").map((id) => `status-${id}`),
    );
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

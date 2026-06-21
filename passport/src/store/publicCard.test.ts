import { describe, it, expect } from "vitest";
import { serializePublicCard, parsePublicCard } from "./publicCard.ts";
import { utf8ToBytes } from "../crypto/index.ts";
import { avatarSrc, DEFAULT_AVATAR } from "../lib/avatars.ts";
import type { ResolvedView } from "../ui/public/PublicResolution.tsx";

const view: ResolvedView = {
  state: "blue",
  labels: ["hiv", "condoms_always"],
  route: "hiv",
  identity: { handle: "robin" },
};

describe("public card codec", () => {
  it("round-trips a resolved card", () => {
    expect(parsePublicCard(serializePublicCard(view))).toEqual(view);
  });

  it("round-trips a card with an avatar and reconstructs its rendered src", () => {
    const withAvatar: ResolvedView = {
      ...view,
      avatar: DEFAULT_AVATAR,
      avatarSrc: avatarSrc(DEFAULT_AVATAR),
    };
    const parsed = parsePublicCard(serializePublicCard(withAvatar));
    expect(parsed.avatar).toEqual(DEFAULT_AVATAR);
    // The src is rebuilt from our template, not carried on the wire.
    expect(parsed.avatarSrc).toBe(avatarSrc(DEFAULT_AVATAR));
    expect(parsed).toEqual(withAvatar);
  });

  it("parses a v1 card (no avatar) — back-compat falls back to no avatar", () => {
    const v1 = {
      v: 1,
      state: "blue",
      labels: ["hiv"],
      route: "hiv",
      handle: "robin",
    };
    const parsed = parsePublicCard(utf8ToBytes(JSON.stringify(v1)));
    expect(parsed.avatar).toBeUndefined();
    expect(parsed.avatarSrc).toBeUndefined();
    expect(parsed.identity.handle).toBe("robin");
  });

  it("normalizes a card with no labels or route", () => {
    const minimal: ResolvedView = {
      state: "gray",
      identity: { handle: "sam" },
    };
    expect(parsePublicCard(serializePublicCard(minimal))).toEqual({
      state: "gray",
      labels: [],
      route: null,
      identity: { handle: "sam" },
    });
  });

  const reject = (label: string, json: unknown) =>
    it(`rejects ${label}`, () => {
      expect(() =>
        parsePublicCard(utf8ToBytes(JSON.stringify(json))),
      ).toThrow();
    });

  reject("non-object", 42);
  reject("a future version", {
    v: 3,
    state: "blue",
    labels: [],
    route: null,
    handle: "x",
  });
  reject("a zero version", {
    v: 0,
    state: "blue",
    labels: [],
    route: null,
    handle: "x",
  });
  reject("a malformed avatar", {
    v: 2,
    state: "blue",
    labels: [],
    route: null,
    handle: "x",
    avatar: { animal: "cat" },
  });
  reject("an invalid state", {
    v: 1,
    state: "platinum",
    labels: [],
    route: null,
    handle: "x",
  });
  reject("an empty handle", {
    v: 1,
    state: "blue",
    labels: [],
    route: null,
    handle: "",
  });
  reject("an invalid label", {
    v: 1,
    state: "blue",
    labels: ["diagnosis"],
    route: null,
    handle: "x",
  });
  reject("an invalid route", {
    v: 1,
    state: "blue",
    labels: [],
    route: "secret",
    handle: "x",
  });

  it("rejects non-JSON bytes", () => {
    expect(() => parsePublicCard(utf8ToBytes("not json {"))).toThrow();
  });
});

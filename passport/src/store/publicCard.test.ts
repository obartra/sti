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

  it("parses a card with the avatar field omitted (falls back to no avatar)", () => {
    const noAvatar = {
      v: 2,
      state: "blue",
      labels: ["hiv"],
      route: "hiv",
      handle: "robin",
    };
    const parsed = parsePublicCard(utf8ToBytes(JSON.stringify(noAvatar)));
    expect(parsed.avatar).toBeUndefined();
    expect(parsed.avatarSrc).toBeUndefined();
    expect(parsed.identity.handle).toBe("robin");
  });

  it("falls back to no avatar for an old-shape or corrupt avatar (doc 19 migration)", () => {
    for (const bad of [
      { animal: 2, color: 1, hat: 0, glasses: 0, extra: 0 }, // pre-doc-19 shape
      { animal: "cat" },
      { hair: 99, mood: 0, tone: 0 }, // out of range
      "garbage",
    ]) {
      const json = {
        v: 2,
        state: "blue",
        labels: ["hiv"],
        route: "hiv",
        handle: "robin",
        avatar: bad,
      };
      const parsed = parsePublicCard(utf8ToBytes(JSON.stringify(json)));
      expect(parsed.avatar).toBeUndefined();
      expect(parsed.avatarSrc).toBeUndefined();
      expect(parsed.identity.handle).toBe("robin");
    }
  });

  it("round-trips the doxy_pep label (producer and validator stay in lockstep)", () => {
    const withDoxy: ResolvedView = {
      ...view,
      labels: ["hiv", "doxy_pep"],
    };
    expect(parsePublicCard(serializePublicCard(withDoxy)).labels).toEqual([
      "hiv",
      "doxy_pep",
    ]);
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
  // Back-compat is intentionally dropped: the pre-avatar v1 shape no longer parses.
  reject("a now-unsupported v1 card", {
    v: 1,
    state: "blue",
    labels: ["hiv"],
    route: "hiv",
    handle: "robin",
  });
  reject("a zero version", {
    v: 0,
    state: "blue",
    labels: [],
    route: null,
    handle: "x",
  });
  reject("an invalid state", {
    v: 2,
    state: "platinum",
    labels: [],
    route: null,
    handle: "x",
  });
  reject("an empty handle", {
    v: 2,
    state: "blue",
    labels: [],
    route: null,
    handle: "",
  });
  reject("an invalid label", {
    v: 2,
    state: "blue",
    labels: ["diagnosis"],
    route: null,
    handle: "x",
  });
  reject("an invalid route", {
    v: 2,
    state: "blue",
    labels: [],
    route: "secret",
    handle: "x",
  });

  it("rejects non-JSON bytes", () => {
    expect(() => parsePublicCard(utf8ToBytes("not json {"))).toThrow();
  });
});

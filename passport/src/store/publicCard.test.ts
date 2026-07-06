import { describe, it, expect } from "vitest";
import {
  serializePublicCard,
  parsePublicCard,
  applyFreshness,
} from "./publicCard.ts";
import { utf8ToBytes } from "../crypto/index.ts";
import { avatarSrc, DEFAULT_AVATAR } from "../lib/avatars.ts";
import type { ResolvedView } from "../ui/public/PublicResolution.tsx";

// A blue card carries its freshness deadline (last panel + the 90-day window); a
// real deriveOwnerCard blue always has one.
const view: ResolvedView = {
  state: "blue",
  labels: ["hiv", "condoms_always"],
  route: "hiv",
  identity: { handle: "robin" },
  freshUntil: 20000,
};

describe("public card codec", () => {
  it("round-trips a resolved card", () => {
    expect(parsePublicCard(serializePublicCard(view))).toEqual(view);
  });

  it("the wire shape is a closed allowlist (never leaks per-site reasoning or any extra field)", () => {
    // doc 02: per-site reasoning is NEVER transmitted; the viewer card carries
    // only the badge facts. Pin the exact wire key set so a future field that
    // smuggles internal state (exposed sites, panel detail, account ids) onto the
    // wire fails this test. freshUntil is the freshness deadline (epoch day), the
    // one time field, and never a per-site reason.
    const decode = (b: Uint8Array): Record<string, unknown> =>
      JSON.parse(new TextDecoder().decode(b)) as Record<string, unknown>;

    expect(Object.keys(decode(serializePublicCard(view))).sort()).toEqual([
      "freshUntil",
      "handle",
      "labels",
      "route",
      "state",
      "v",
    ]);

    const withAvatar: ResolvedView = {
      ...view,
      avatar: DEFAULT_AVATAR,
      avatarSrc: avatarSrc(DEFAULT_AVATAR),
    };
    const wire = decode(serializePublicCard(withAvatar));
    expect(Object.keys(wire).sort()).toEqual([
      "avatar",
      "freshUntil",
      "handle",
      "labels",
      "route",
      "state",
      "v",
    ]);
    // avatarSrc is rebuilt from our template on read, never carried on the wire.
    expect("avatarSrc" in wire).toBe(false);

    // G11: the wire carries a self-chosen `handle`, never a real-name field. A future
    // field called name/firstname/lastname/legal would be a PII leak, so fail on any
    // such key in either wire shape (with and without an avatar).
    const NAMEY = /name|firstname|lastname|legal/i;
    for (const shape of [
      decode(serializePublicCard(view)),
      decode(serializePublicCard(withAvatar)),
    ]) {
      for (const key of Object.keys(shape)) {
        expect(NAMEY.test(key), `forbidden name-like wire key: ${key}`).toBe(
          false,
        );
      }
    }
  });

  it("carries freshUntil only on blue (gray is already fail-closed)", () => {
    const decode = (b: Uint8Array): Record<string, unknown> =>
      JSON.parse(new TextDecoder().decode(b)) as Record<string, unknown>;
    // A gray card with a stray freshUntil never puts it on the wire.
    const grayWithDeadline: ResolvedView = {
      state: "gray",
      labels: ["hiv"],
      identity: { handle: "sam" },
      freshUntil: 20000,
    };
    expect("freshUntil" in decode(serializePublicCard(grayWithDeadline))).toBe(
      false,
    );
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
      v: 3,
      state: "blue",
      labels: ["hiv"],
      route: "hiv",
      handle: "robin",
      freshUntil: 20000,
    };
    const parsed = parsePublicCard(utf8ToBytes(JSON.stringify(noAvatar)));
    expect(parsed.avatar).toBeUndefined();
    expect(parsed.avatarSrc).toBeUndefined();
    expect(parsed.identity.handle).toBe("robin");
  });

  it("ignores a malformed freshUntil (fail-safe: parses without a deadline)", () => {
    const badDeadline = {
      v: 3,
      state: "blue",
      labels: ["hiv"],
      route: "hiv",
      handle: "robin",
      freshUntil: "soon",
    };
    const parsed = parsePublicCard(utf8ToBytes(JSON.stringify(badDeadline)));
    expect(parsed.freshUntil).toBeUndefined();
    // A blue card with no usable deadline fails closed to gray at read time.
    expect(applyFreshness(parsed, 20000)?.state).toBe("gray");
  });

  it("falls back to no avatar for an old-shape or corrupt avatar (doc 19 migration)", () => {
    for (const bad of [
      { animal: 2, color: 1, hat: 0, glasses: 0, extra: 0 }, // pre-doc-19 shape
      { animal: "cat" },
      { hair: 99, mood: 0, tone: 0 }, // out of range
      "garbage",
    ]) {
      const json = {
        v: 3,
        state: "blue",
        labels: ["hiv"],
        route: "hiv",
        handle: "robin",
        freshUntil: 20000,
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
    v: 4,
    state: "blue",
    labels: [],
    route: null,
    handle: "x",
  });
  // Back-compat is intentionally dropped: the pre-freshness v2 (and pre-avatar v1)
  // shapes no longer parse; an older link resolves gray until the owner republishes.
  reject("a now-unsupported v2 card", {
    v: 2,
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
    v: 3,
    state: "platinum",
    labels: [],
    route: null,
    handle: "x",
  });
  reject("an empty handle", {
    v: 3,
    state: "blue",
    labels: [],
    route: null,
    handle: "",
  });
  reject("an invalid label", {
    v: 3,
    state: "blue",
    labels: ["diagnosis"],
    route: null,
    handle: "x",
  });
  reject("an invalid route", {
    v: 3,
    state: "blue",
    labels: [],
    route: "secret",
    handle: "x",
  });

  it("rejects non-JSON bytes", () => {
    expect(() => parsePublicCard(utf8ToBytes("not json {"))).toThrow();
  });
});

describe("applyFreshness (read-time stale-blue fail-closed, doc 02)", () => {
  const blue: ResolvedView = {
    state: "blue",
    labels: ["hiv"],
    route: "hiv",
    identity: { handle: "robin" },
    avatar: DEFAULT_AVATAR,
    avatarSrc: avatarSrc(DEFAULT_AVATAR),
    freshUntil: 20000,
  };

  it("keeps a blue card blue on and before its deadline", () => {
    expect(applyFreshness(blue, 20000)).toEqual(blue);
    expect(applyFreshness(blue, 19999)?.state).toBe("blue");
  });

  it("fails a blue card closed to gray the day after its deadline", () => {
    const gray = applyFreshness(blue, 20001);
    expect(gray).toEqual({
      state: "gray",
      route: null,
      identity: { handle: "robin" },
      labels: ["hiv"],
      avatar: DEFAULT_AVATAR,
      avatarSrc: avatarSrc(DEFAULT_AVATAR),
    });
    // The blue-only headline route and the deadline are gone; it reads like any gray.
    expect(gray?.route).toBeNull();
    expect("freshUntil" in (gray ?? {})).toBe(false);
  });

  it("fails a blue card with no deadline closed to gray", () => {
    const noDeadline: ResolvedView = {
      state: "blue",
      identity: { handle: "x" },
    };
    expect(applyFreshness(noDeadline, 20000)?.state).toBe("gray");
  });

  it("passes gray and null through unchanged", () => {
    const gray: ResolvedView = { state: "gray", identity: { handle: "x" } };
    expect(applyFreshness(gray, 99999)).toBe(gray);
    expect(applyFreshness(null, 99999)).toBeNull();
  });
});

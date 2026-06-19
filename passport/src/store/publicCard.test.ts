import { describe, it, expect } from "vitest";
import { serializePublicCard, parsePublicCard } from "./publicCard.ts";
import { utf8ToBytes } from "../crypto/index.ts";
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
  reject("an unknown version", {
    v: 2,
    state: "blue",
    labels: [],
    route: null,
    handle: "x",
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

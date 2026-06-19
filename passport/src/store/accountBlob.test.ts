import { describe, it, expect } from "vitest";
import { serializeAccountBlob, parseAccountBlob } from "./accountBlob.ts";
import { utf8ToBytes } from "../crypto/index.ts";
import type { AccountBlob } from "./accountBlob.ts";

const ID = "A".repeat(43);
const blob: AccountBlob = {
  handle: "robin",
  aliases: [
    { id: ID, writeToken: "B".repeat(43), key: "C".repeat(43), isPublic: true },
  ],
};

describe("account blob codec", () => {
  it("round-trips", () => {
    expect(parseAccountBlob(serializeAccountBlob(blob))).toEqual(blob);
  });

  it("round-trips an empty alias list", () => {
    const empty: AccountBlob = { handle: "sam", aliases: [] };
    expect(parseAccountBlob(serializeAccountBlob(empty))).toEqual(empty);
  });

  const reject = (label: string, json: unknown) =>
    it(`rejects ${label}`, () => {
      expect(() =>
        parseAccountBlob(utf8ToBytes(JSON.stringify(json))),
      ).toThrow();
    });

  reject("a non-object", 7);
  reject("an unknown version", { v: 9, handle: "x", aliases: [] });
  reject("an empty handle", { v: 1, handle: "", aliases: [] });
  reject("a non-array aliases", { v: 1, handle: "x", aliases: {} });
  reject("an alias with a malformed id", {
    v: 1,
    handle: "x",
    aliases: [{ id: "short", writeToken: ID, key: ID, isPublic: true }],
  });
  reject("an alias missing isPublic", {
    v: 1,
    handle: "x",
    aliases: [{ id: ID, writeToken: ID, key: ID }],
  });
});

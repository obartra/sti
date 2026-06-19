import { describe, it, expect } from "vitest";
import { parseAliasLink } from "./aliasLink.ts";

const ID = "A".repeat(43);
const KEY = "B".repeat(43);

describe("parseAliasLink", () => {
  it("parses a public link: id from the path, key from the fragment", () => {
    expect(parseAliasLink(`/a/${ID}`, `#k=${KEY}`)).toEqual({
      id: ID,
      key: KEY,
    });
  });

  it("tolerates a trailing slash on the path", () => {
    expect(parseAliasLink(`/a/${ID}/`, `#k=${KEY}`)).toEqual({
      id: ID,
      key: KEY,
    });
  });

  it("returns null for a private link (no key fragment)", () => {
    expect(parseAliasLink(`/a/${ID}`, "")).toBeNull();
    expect(parseAliasLink(`/a/${ID}`, "#a2-public")).toBeNull();
  });

  it("returns null for a non-alias path (internal hash routing)", () => {
    expect(parseAliasLink("/", "#wallet")).toBeNull();
    expect(parseAliasLink("/promises/", "#k=" + KEY)).toBeNull();
  });

  it("returns null for a malformed id", () => {
    expect(parseAliasLink("/a/too-short", `#k=${KEY}`)).toBeNull();
  });

  it("returns null for a malformed key", () => {
    expect(parseAliasLink(`/a/${ID}`, "#k=too-short")).toBeNull();
  });
});

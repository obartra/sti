import { describe, it, expect } from "vitest";
import {
  parseAliasLink,
  parseScannedLink,
  aliasIdFromPath,
} from "./aliasLink.ts";

const ID = "A".repeat(43);
const KEY = "B".repeat(43);

describe("aliasIdFromPath", () => {
  it("returns the id whether or not a key fragment is present", () => {
    // A keyless `/a/{id}` is a real (gated) link, so the id still parses out.
    expect(aliasIdFromPath(`/a/${ID}`)).toBe(ID);
    expect(aliasIdFromPath(`/a/${ID}/`)).toBe(ID); // trailing slash
  });

  it("returns null for a malformed id or a non-alias path", () => {
    for (const p of ["/a/too-short", "/", "/home", "/u/robin", "/exposed"]) {
      expect(aliasIdFromPath(p)).toBeNull();
    }
  });
});

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

describe("parseScannedLink", () => {
  it("parses a full sti.care alias URL", () => {
    expect(parseScannedLink(`https://sti.care/a/${ID}#k=${KEY}`)).toEqual({
      id: ID,
      key: KEY,
    });
  });

  it("tolerates surrounding whitespace from the decoder", () => {
    expect(parseScannedLink(`  https://sti.care/a/${ID}#k=${KEY}\n`)).toEqual({
      id: ID,
      key: KEY,
    });
  });

  it("rejects a link to any other host (untrusted QR cannot redirect off-site)", () => {
    expect(
      parseScannedLink(`https://evil.example/a/${ID}#k=${KEY}`),
    ).toBeNull();
    // Even a look-alike subdomain is rejected: only the exact host is followed.
    expect(
      parseScannedLink(`https://sti.care.evil.com/a/${ID}#k=${KEY}`),
    ).toBeNull();
  });

  it("accepts an explicit same-origin host (local/preview testing)", () => {
    expect(
      parseScannedLink(
        `http://localhost:5173/a/${ID}#k=${KEY}`,
        "localhost:5173",
      ),
    ).toEqual({ id: ID, key: KEY });
  });

  it("returns null for non-URL junk or a non-alias sti.care URL", () => {
    expect(parseScannedLink("not a url")).toBeNull();
    expect(parseScannedLink("https://sti.care/about")).toBeNull();
    expect(parseScannedLink(`https://sti.care/a/${ID}`)).toBeNull(); // no key
  });
});

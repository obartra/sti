// @vitest-environment node
import { describe, it, expect } from "vitest";
import { randomAliasId } from "../crypto/index.ts";
import { isShareTargetRequest, shareTargetRedirect } from "./swShare.ts";

const SCOPE = "https://app.example/";
const SELF = "app.example";

describe("isShareTargetRequest (doc 22 C)", () => {
  it("matches only the share-target POST", () => {
    expect(
      isShareTargetRequest("POST", "https://app.example/share-target", SCOPE),
    ).toBe(true);
    // Wrong method, wrong path, and a foreign origin are all left to normal routing.
    expect(
      isShareTargetRequest("GET", "https://app.example/share-target", SCOPE),
    ).toBe(false);
    expect(isShareTargetRequest("POST", "https://app.example/a/x", SCOPE)).toBe(
      false,
    );
    expect(isShareTargetRequest("POST", "not a url", SCOPE)).toBe(false);
  });
});

describe("shareTargetRedirect (doc 22 C)", () => {
  const id = randomAliasId();
  const key = randomAliasId();
  const link = `https://sti.care/a/${id}#k=${key}`;

  it("redirects a shared keyed link to its in-app card route, keeping the key", () => {
    expect(shareTargetRedirect({ url: link }, SCOPE, SELF)).toBe(
      `${SCOPE}a/${id}#k=${key}`,
    );
  });

  it("uses the text field when url is absent", () => {
    expect(shareTargetRedirect({ text: link }, SCOPE, SELF)).toBe(
      `${SCOPE}a/${id}#k=${key}`,
    );
  });

  it("falls back to the app root on a keyless link (no leak, no junk)", () => {
    expect(
      shareTargetRedirect({ url: `https://sti.care/a/${id}` }, SCOPE, SELF),
    ).toBe(SCOPE);
  });

  it("falls back to the app root on a foreign host", () => {
    expect(
      shareTargetRedirect(
        { url: `https://evil.example/a/${id}#k=${key}` },
        SCOPE,
        SELF,
      ),
    ).toBe(SCOPE);
  });

  it("falls back to the app root on junk or empty input", () => {
    expect(shareTargetRedirect({ text: "hello" }, SCOPE, SELF)).toBe(SCOPE);
    expect(shareTargetRedirect({}, SCOPE, SELF)).toBe(SCOPE);
  });
});

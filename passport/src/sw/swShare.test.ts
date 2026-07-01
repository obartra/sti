// @vitest-environment node
import { describe, it, expect } from "vitest";
import { randomAliasId } from "../crypto/index.ts";
import { isShareTargetRequest, shareTargetRedirect } from "./swShare.ts";

const SCOPE = "https://app.example/";

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
    expect(shareTargetRedirect({ url: link }, SCOPE)).toBe(
      `${SCOPE}a/${id}#k=${key}`,
    );
  });

  it("uses the text field when url is absent", () => {
    expect(shareTargetRedirect({ text: link }, SCOPE)).toBe(
      `${SCOPE}a/${id}#k=${key}`,
    );
  });

  it("rebuilds the redirect in-scope regardless of the link's host", () => {
    // A preview/other host still redirects to OUR scope with the id + key; the
    // host is never followed, so this is safe and lets preview links resolve.
    expect(
      shareTargetRedirect(
        {
          url: `https://deploy-preview-9--sticare.netlify.app/a/${id}#k=${key}`,
        },
        SCOPE,
      ),
    ).toBe(`${SCOPE}a/${id}#k=${key}`);
  });

  it("falls back to the app root on a keyless link (no leak, no junk)", () => {
    expect(
      shareTargetRedirect({ url: `https://sti.care/a/${id}` }, SCOPE),
    ).toBe(SCOPE);
  });

  it("falls back to the app root on junk or empty input", () => {
    expect(shareTargetRedirect({ text: "hello" }, SCOPE)).toBe(SCOPE);
    expect(shareTargetRedirect({}, SCOPE)).toBe(SCOPE);
  });
});

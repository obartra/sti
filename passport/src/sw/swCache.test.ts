import { describe, it, expect } from "vitest";
import { classify, shellCacheName, isStaleShellCache } from "./swCache.ts";

const ORIGIN = "https://sti.care";
const nav = (url: string, method = "GET"): string =>
  classify({ method, url, origin: ORIGIN, isNavigate: true });
const sub = (url: string, method = "GET"): string =>
  classify({ method, url, origin: ORIGIN, isNavigate: false });

describe("service worker route classification (slice 2)", () => {
  it("passes through cross-origin requests, including the API", () => {
    // The whole privacy line: the API is a different origin, so it is never ours
    // to cache, with no host allowlist to drift.
    expect(sub("https://api.sti.care/a/abc")).toBe("passthrough");
    expect(nav("https://api.sti.care/a/abc")).toBe("passthrough");
  });

  it("passes through non-GET methods", () => {
    expect(sub("https://sti.care/assets/x.js", "POST")).toBe("passthrough");
    expect(nav("https://sti.care/", "POST")).toBe("passthrough");
  });

  it("passes through non-http schemes", () => {
    expect(sub("chrome-extension://abc/inject.js")).toBe("passthrough");
  });

  it("passes through a malformed URL rather than throwing", () => {
    expect(sub("not a url")).toBe("passthrough");
  });

  it("serves a same-origin navigation network-first (the shell, not the card)", () => {
    expect(nav("https://sti.care/")).toBe("navigation");
    // A shared link path resolves to the app shell; the card itself is fetched
    // cross-origin from the API and never reaches this cache.
    expect(nav("https://sti.care/a/xyz")).toBe("navigation");
  });

  it("serves a same-origin sub-resource cache-first", () => {
    expect(sub("https://sti.care/assets/index-abc123.js")).toBe("asset");
    expect(sub("https://sti.care/icons/icon-192.png")).toBe("asset");
  });

  it("versions and evicts shell caches", () => {
    expect(shellCacheName("v1.2.3")).toBe("shell-v1.2.3");
    expect(isStaleShellCache("shell-v1.0.0", "shell-v1.2.3")).toBe(true);
    expect(isStaleShellCache("shell-v1.2.3", "shell-v1.2.3")).toBe(false);
    // A non-shell cache (e.g. the push store) is never touched.
    expect(isStaleShellCache("sti-push", "shell-v1.2.3")).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import {
  findableNameFromPath,
  routeFromLocation,
  useAppRouter,
} from "./useAppRouter.ts";
import { groupOf } from "./routes.ts";

describe("routeFromLocation: shared alias links", () => {
  const ID = "tW0gEbDrF_r7_70h-NRAYsSTDUQ8_SLbJdohXqFGYog";
  const KEY = "A".repeat(43);
  const at = (path: string) => {
    window.history.replaceState(null, "", path);
    return routeFromLocation();
  };

  it("routes a keyed /a/{id}#k= to a2-public with the id and key", () => {
    const r = at(`/a/${ID}#k=${KEY}`);
    expect(r?.screen).toBe("a2-public");
    expect(r?.data?.id).toBe(ID);
    expect(r?.data?.key).toBe(KEY);
  });

  it("routes a KEYLESS /a/{id} to the ask-to-view card, not the landing", () => {
    // Regression: a gated "ask first" share has no #k=. It must still land on
    // a2-public (which shows Request access), never fall through to a1-landing.
    const r = at(`/a/${ID}`);
    expect(r?.screen).toBe("a2-public");
    expect(r?.data?.id).toBe(ID);
    expect(r?.data?.key).toBeUndefined();
  });

  it("does not treat a malformed /a path as an alias link", () => {
    expect(at("/a/too-short")).toBeNull();
  });
});

describe("useAppRouter: a decryption key never leaves the URL fragment", () => {
  const ID = "tW0gEbDrF_r7_70h-NRAYsSTDUQ8_SLbJdohXqFGYog";
  const KEY = "B".repeat(43);

  it("leaves a keyed /a/{id}#k= URL untouched", () => {
    // The URL-sync effect must NOT rewrite a keyed alias link: the #k= fragment is
    // the only place the key lives, and /a/{id} is the canonical shareable address.
    window.history.replaceState(null, "", `/a/${ID}#k=${KEY}`);
    try {
      renderHook(() => useAppRouter());
      expect(window.location.pathname).toBe(`/a/${ID}`);
      expect(window.location.hash).toBe(`#k=${KEY}`);
    } finally {
      window.history.replaceState(null, "", "/");
    }
  });

  it("wipes the key from window.location when navigating away", () => {
    // Leaving the public-resolution screen must drop the key entirely: the
    // away-target is built from the screen name alone, never by relocating the
    // fragment into a viewer-visible, referrer-leaking path or query.
    window.history.replaceState(null, "", `/a/${ID}#k=${KEY}`);
    try {
      const { result } = renderHook(() => useAppRouter());
      act(() => result.current.nav.jump("home"));
      expect(window.location.href).not.toContain(KEY);
      expect(window.location.pathname).not.toContain(KEY);
      expect(window.location.search).not.toContain(KEY);
      expect(window.location.hash).not.toContain(KEY);
    } finally {
      window.history.replaceState(null, "", "/");
    }
  });
});

describe("findableNameFromPath", () => {
  it("extracts and normalizes the name from /u/{name}", () => {
    expect(findableNameFromPath("/u/robin")).toBe("robin");
    expect(findableNameFromPath("/u/RoBiN")).toBe("robin"); // normalized
    expect(findableNameFromPath("/u/robin/")).toBe("robin"); // trailing slash
    expect(findableNameFromPath("/u/free_money")).toBe("free_money");
  });

  it("returns null for non-/u paths and extra segments", () => {
    for (const p of ["/", "/home", "/a/robin", "/exposed", "/u/", "/u/a/b"]) {
      expect(findableNameFromPath(p)).toBeNull();
    }
  });

  it("fails closed on a malformed percent-encoding instead of throwing", () => {
    // decodeURIComponent would throw on these; the helper must not.
    expect(() => findableNameFromPath("/u/%E0%A4%A")).not.toThrow();
    expect(() => findableNameFromPath("/u/%")).not.toThrow();
    // It still returns a (normalized) string the resolve step will 404 on.
    expect(findableNameFromPath("/u/%")).toBe("%");
  });

  it("decodes a valid percent-encoded segment", () => {
    expect(findableNameFromPath("/u/ro%62in")).toBe("robin"); // %62 = 'b'
  });
});

describe("the /promises path", () => {
  it("routes to the in-app promises page in the public group (anonymous-reachable)", () => {
    window.history.pushState({}, "", "/promises");
    try {
      const { result } = renderHook(() => useAppRouter());
      expect(result.current.route.screen).toBe("promises");
      expect(result.current.route.group).toBe("public");
    } finally {
      window.history.pushState({}, "", "/");
    }
  });

  it("keeps promises in the public group, so the login gate never clamps it", () => {
    // App.tsx clamps app-group screens to the landing when logged out; a public
    // group is what lets an anonymous visitor see /promises.
    expect(groupOf("promises")).toBe("public");
  });
});

describe("the trust pages own clean, real paths", () => {
  const at = (path: string) => {
    window.history.replaceState(null, "", path);
    try {
      const { result } = renderHook(() => useAppRouter());
      return result.current.route;
    } finally {
      window.history.replaceState(null, "", "/");
    }
  };

  it("routes /privacy and /terms to the public trust pages (no #fragment)", () => {
    expect(at("/privacy").screen).toBe("privacy-policy");
    expect(at("/privacy").group).toBe("public");
    expect(at("/terms").screen).toBe("terms");
    expect(at("/terms").group).toBe("public");
    // A trailing slash is tolerated.
    expect(at("/privacy/").screen).toBe("privacy-policy");
  });

  it("normalizes the screen to its clean path, not a /#fragment", async () => {
    window.history.replaceState(null, "", "/");
    try {
      const { result } = renderHook(() => useAppRouter());
      act(() => result.current.nav.go("terms"));
      await waitFor(() => {
        expect(window.location.pathname).toBe("/terms");
        expect(window.location.hash).toBe("");
      });
    } finally {
      window.history.replaceState(null, "", "/");
    }
  });

  it("follows the browser back button (popstate) to the new URL", () => {
    window.history.replaceState(null, "", "/privacy");
    try {
      const { result } = renderHook(() => useAppRouter());
      expect(result.current.route.screen).toBe("privacy-policy");
      act(() => {
        // Simulate the browser back button: the URL changes, then popstate fires.
        window.history.replaceState(null, "", "/");
        window.dispatchEvent(new PopStateEvent("popstate"));
      });
      expect(result.current.route.screen).toBe("a1-landing");
    } finally {
      window.history.replaceState(null, "", "/");
    }
  });
});

describe("the landing keeps the clean root URL", () => {
  it("visiting / stays at / and does not bounce to /#a1-landing", async () => {
    window.history.replaceState(null, "", "/");
    try {
      const { result } = renderHook(() => useAppRouter());
      // The bare root resolves to the landing...
      expect(result.current.route.screen).toBe("a1-landing");
      // ...and the URL is normalized to the clean root, not /#a1-landing.
      await waitFor(() => {
        expect(window.location.pathname).toBe("/");
        expect(window.location.hash).toBe("");
      });
    } finally {
      window.history.replaceState(null, "", "/");
    }
  });

  it("normalizes a stale /#a1-landing back to the clean root", async () => {
    window.history.replaceState(null, "", "/#a1-landing");
    try {
      const { result } = renderHook(() => useAppRouter());
      expect(result.current.route.screen).toBe("a1-landing");
      await waitFor(() => expect(window.location.hash).toBe(""));
      expect(window.location.pathname).toBe("/");
    } finally {
      window.history.replaceState(null, "", "/");
    }
  });
});

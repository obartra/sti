import { describe, it, expect } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import {
  findableNameFromPath,
  routeFromLocation,
  useAppRouter,
} from "./useAppRouter.ts";
import { groupOf } from "./routes.ts";
import { groupInviteUrl, type GroupInvite } from "../../store/groupInvite.ts";

describe("routeFromLocation: group invite links (doc 33)", () => {
  const TOK = "A".repeat(43);
  const invite: GroupInvite = {
    groupId: TOK,
    lifecycleInbox: { inboxId: TOK, writeToken: TOK, key: TOK },
    handle: "thursday_run",
    visibility: "private",
    meetingKind: "event",
  };

  it("dispatches /g#g=<...> to the public group-invite screen with the parsed invite", () => {
    const url = new URL(groupInviteUrl(invite));
    window.history.replaceState(null, "", url.pathname + url.hash);
    const r = routeFromLocation();
    expect(r?.screen).toBe("group-invite");
    expect(r?.group).toBe("public");
    expect(r?.data?.invite?.handle).toBe("thursday_run");
    expect(r?.data?.invite?.meetingKind).toBe("event");
    window.history.replaceState(null, "", "/");
  });

  it("ignores a /g path with no g= fragment", () => {
    window.history.replaceState(null, "", "/g");
    expect(routeFromLocation()?.screen).not.toBe("group-invite");
    window.history.replaceState(null, "", "/");
  });
});

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
      // The root resolves to Home (App clamps to the landing when signed out).
      expect(result.current.route.screen).toBe("home");
    } finally {
      window.history.replaceState(null, "", "/");
    }
  });
});

describe("parameterized deep-links and cold-hit redirects", () => {
  const routeAt = (path: string) => {
    window.history.replaceState(null, "", path);
    try {
      return routeFromLocation();
    } finally {
      window.history.replaceState(null, "", "/");
    }
  };

  it("leaves a /u/{name} findable link untouched (task #13 regression)", () => {
    // The bug: visiting /u/robin used to be rewritten to /#u-resolve, losing the
    // name. The name must survive a mount so refresh/share works.
    window.history.replaceState(null, "", "/u/robin");
    try {
      const { result } = renderHook(() => useAppRouter());
      expect(result.current.route.screen).toBe("u-resolve");
      expect(result.current.route.data?.name).toBe("robin");
      expect(window.location.pathname).toBe("/u/robin");
      expect(window.location.hash).toBe("");
    } finally {
      window.history.replaceState(null, "", "/");
    }
  });

  it("round-trips id-carrying app paths", () => {
    expect(routeAt("/groups/abc123")).toMatchObject({
      screen: "group-detail",
      data: { id: "abc123" },
    });
    expect(routeAt("/groups/abc123/edit")).toMatchObject({
      screen: "group-create",
      data: { id: "abc123" },
    });
  });

  it("does not mistake the fixed /groups/new for an id", () => {
    expect(routeAt("/groups/new")?.screen).toBe("group-create");
    expect(routeAt("/groups/new")?.data).toBeNull();
  });

  it("redirects the cold transient paths to a safe fallback", () => {
    // These depend on in-memory flow state, so a cold refresh redirects rather
    // than rendering an empty shell.
    expect(routeAt("/recovery")?.screen).toBe("b1-claim");
    expect(routeAt("/setup")?.screen).toBe("b1-claim");
    expect(routeAt("/report/saved")?.screen).toBe("home");
  });

  it("normalizes a group-detail nav to /groups/{id}", async () => {
    window.history.replaceState(null, "", "/groups");
    try {
      const { result } = renderHook(() => useAppRouter());
      act(() => result.current.nav.go("group-detail", { id: "xyz" }));
      await waitFor(() => {
        expect(window.location.pathname).toBe("/groups/xyz");
      });
      expect(result.current.route.data?.id).toBe("xyz");
    } finally {
      window.history.replaceState(null, "", "/");
    }
  });
});

describe("every screen owns a clean path", () => {
  const routeAt = (path: string) => {
    window.history.replaceState(null, "", path);
    try {
      return routeFromLocation();
    } finally {
      window.history.replaceState(null, "", "/");
    }
  };

  it("routes app screens from their clean paths", () => {
    expect(routeAt("/")?.screen).toBe("home");
    expect(routeAt("/people")?.screen).toBe("people");
    expect(routeAt("/links")?.screen).toBe("links");
    expect(routeAt("/groups")?.screen).toBe("groups");
    expect(routeAt("/groups/new")?.screen).toBe("group-create");
    expect(routeAt("/links/share")?.screen).toBe("alias-share");
    expect(routeAt("/people/scan")?.screen).toBe("scan");
    expect(routeAt("/wallet")?.screen).toBe("wallet");
  });

  it("redirects the legacy Connect paths to People / Links (installed PWAs)", () => {
    // The old `home / connect / groups / care` bar became `home / links / people /
    // care`; an installed shortcut or bookmark must still land somewhere sensible.
    expect(routeAt("/connect")?.screen).toBe("people");
    expect(routeAt("/connect/scan")?.screen).toBe("scan");
    expect(routeAt("/connect/share")?.screen).toBe("alias-share");
  });

  it("redirects the legacy /home path to Home at the root (old bookmarks)", () => {
    // Home moved from `/home` to the root `/`; an old shortcut or bookmark still
    // resolves to Home, and mount normalizes the URL back to `/`.
    expect(routeAt("/home")?.screen).toBe("home");
  });

  it("keeps the Settings screen (/settings) distinct from the privacy POLICY (/privacy)", () => {
    // The old id clash: route id `privacy` is the Settings screen; the policy page
    // is `privacy-policy`. The paths are unambiguous.
    expect(routeAt("/settings")?.screen).toBe("privacy");
    expect(routeAt("/settings")?.group).toBe("app");
    expect(routeAt("/privacy")?.screen).toBe("privacy-policy");
    expect(routeAt("/privacy")?.group).toBe("public");
  });

  it("normalizes the Settings screen to /settings, never /#privacy", async () => {
    window.history.replaceState(null, "", "/");
    try {
      const { result } = renderHook(() => useAppRouter());
      act(() => result.current.nav.go("privacy"));
      await waitFor(() => {
        expect(window.location.pathname).toBe("/settings");
        expect(window.location.hash).toBe("");
      });
    } finally {
      window.history.replaceState(null, "", "/");
    }
  });

  it("no longer honors a legacy /#home bookmark (the transitional reader is gone)", async () => {
    // Every screen owns a clean path now, so the `/#screen` hash is not read: a
    // stale bookmark falls through to the bare-root entry (Home) and the hash is
    // stripped on mount, rather than deep-linking to a `/#home` fragment.
    window.history.replaceState(null, "", "/#home");
    try {
      const { result } = renderHook(() => useAppRouter());
      expect(result.current.route.screen).toBe("home");
      await waitFor(() => {
        expect(window.location.pathname).toBe("/");
        expect(window.location.hash).toBe("");
      });
    } finally {
      window.history.replaceState(null, "", "/");
    }
  });
});

describe("back is driven by the browser history, not an in-app stack", () => {
  it("go pushes an entry; a back (popstate) returns to the prior screen", () => {
    window.history.replaceState(null, "", "/");
    try {
      const { result } = renderHook(() => useAppRouter());
      expect(result.current.route.screen).toBe("home");
      act(() => result.current.nav.go("wallet"));
      expect(window.location.pathname).toBe("/wallet");
      expect(result.current.route.screen).toBe("wallet");
      act(() => {
        // The browser back button: the URL returns, then popstate fires.
        window.history.replaceState(null, "", "/");
        window.dispatchEvent(new PopStateEvent("popstate"));
      });
      expect(result.current.route.screen).toBe("home");
    } finally {
      window.history.replaceState(null, "", "/");
    }
  });

  it("jump replaces (a tab switch is not a back target) and back falls home", () => {
    window.history.replaceState(null, "", "/");
    try {
      const { result } = renderHook(() => useAppRouter());
      act(() => result.current.nav.jump("care"));
      expect(window.location.pathname).toBe("/care");
      expect(result.current.route.screen).toBe("care");
      // jump reset the app-pushed depth, so back has nothing of ours to pop and
      // falls to home rather than stepping off the site.
      act(() => result.current.nav.back());
      expect(result.current.route.screen).toBe("home");
    } finally {
      window.history.replaceState(null, "", "/");
    }
  });
});

describe("the root keeps the clean URL", () => {
  it("visiting / resolves to Home and stays at / (no /#home bounce)", async () => {
    window.history.replaceState(null, "", "/");
    try {
      const { result } = renderHook(() => useAppRouter());
      // The bare root resolves to Home (App clamps it to the landing when there is
      // no session; see App.test.tsx)...
      expect(result.current.route.screen).toBe("home");
      // ...and the URL stays the clean root, never a /#home fragment.
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
      // The `/#screen` hash is no longer read, so this falls to the bare-root Home
      // and the stale fragment is stripped on mount.
      expect(result.current.route.screen).toBe("home");
      await waitFor(() => expect(window.location.hash).toBe(""));
      expect(window.location.pathname).toBe("/");
    } finally {
      window.history.replaceState(null, "", "/");
    }
  });
});

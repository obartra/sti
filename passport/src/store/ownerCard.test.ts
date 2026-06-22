import { describe, it, expect } from "vitest";
import {
  deriveOwnerCard,
  deriveAliasCard,
  resolveCardIdentity,
  withIdentity,
} from "./ownerCard.ts";
import { NOW_DAY, daysAgo } from "../core/badge.fixtures.ts";
import { pseudonymFor, avatarSrc, DEFAULT_AVATAR } from "../lib/avatars.ts";
import type { OwnerState } from "../core/badge.ts";
import type { AliasRecord } from "./accountBlob.ts";

const tested = {
  lastPanelDay: daysAgo(10),
  corePanelComplete: true,
  exposedSitesCovered: true,
};

// Base: blue via PrEP, no public condom preference.
function state(over: Partial<OwnerState> = {}): OwnerState {
  return {
    testing: tested,
    hiv: "negative",
    activeNonHivSti: false,
    onPrep: true,
    condomPreference: "none",
    condomPreferencePublic: false,
    onDoxyPep: false,
    paused: false,
    clearUntilDay: null,
    ...over,
  };
}

// Every card is derived as of NOW_DAY (tested 10 days ago = in window).
const card = (s: OwnerState, handle: string) =>
  deriveOwnerCard(s, handle, NOW_DAY);

describe("deriveOwnerCard", () => {
  it("blue via PrEP: umbrella label + umbrella route", () => {
    expect(card(state(), "robin")).toEqual({
      state: "blue",
      labels: ["hiv"],
      route: "hiv",
      identity: { handle: "robin" },
    });
  });

  it("undetectable is indistinguishable from PrEP (same umbrella)", () => {
    const c = card(
      state({ onPrep: false, hiv: "positive_undetectable" }),
      "robin",
    );
    expect(c.labels).toEqual(["hiv"]);
    expect(c.route).toBe("hiv");
  });

  it("blue via public condoms-always: condom label + condom route", () => {
    expect(
      card(
        state({
          onPrep: false,
          condomPreference: "condoms_always",
          condomPreferencePublic: true,
        }),
        "sam",
      ),
    ).toEqual({
      state: "blue",
      labels: ["condoms_always"],
      route: "condoms_always",
      identity: { handle: "sam" },
    });
  });

  it("umbrella wins the headline when both routes are present", () => {
    const c = card(
      state({
        condomPreference: "condoms_always",
        condomPreferencePublic: true,
      }),
      "robin",
    );
    expect(c.labels).toEqual(["hiv", "condoms_always"]);
    expect(c.route).toBe("hiv"); // never re-headlined by condom use
  });

  it("a non-public condom preference shows no condom label", () => {
    const c = card(
      state({
        onPrep: false,
        condomPreference: "condoms_always",
        condomPreferencePublic: false,
      }),
      "sam",
    );
    expect(c.state).toBe("gray"); // no qualifying public route
    expect(c.labels).toEqual([]);
    expect(c.route).toBeNull();
  });

  it("a public non-always condom preference shows as a flat label, not a route", () => {
    const c = card(
      state({ condomPreference: "either", condomPreferencePublic: true }),
      "robin",
    );
    expect(c.labels).toEqual(["hiv", "condoms_either"]); // blue via umbrella
    expect(c.route).toBe("hiv");
  });

  it("labels still show on gray; only the headline route is gated on blue", () => {
    const gray = card(
      state({ testing: { ...tested, lastPanelDay: daysAgo(200) } }),
      "robin",
    );
    expect(gray.state).toBe("gray");
    expect(gray.labels).toEqual(["hiv"]); // attribute shows regardless of color
    expect(gray.route).toBeNull();
  });

  it("pause forces gray but keeps labels", () => {
    const c = card(state({ paused: true }), "robin");
    expect(c.state).toBe("gray");
    expect(c.labels).toEqual(["hiv"]);
    expect(c.route).toBeNull();
  });

  it("detectable HIV forces gray even with condoms-always", () => {
    const c = card(
      state({
        onPrep: false,
        hiv: "positive_detectable",
        condomPreference: "condoms_always",
        condomPreferencePublic: true,
      }),
      "robin",
    );
    expect(c.state).toBe("gray");
    expect(c.labels).toEqual(["condoms_always"]);
    expect(c.route).toBeNull();
  });

  it("doxy-PEP shows as a flat label, never a route, and never affects the badge", () => {
    // On a gray owner with no route, doxy-PEP still shows (labels are gated by
    // sharing, not color) and does not earn blue.
    const gray = card(state({ onPrep: false, onDoxyPep: true }), "robin");
    expect(gray.state).toBe("gray");
    expect(gray.labels).toEqual(["doxy_pep"]);
    expect(gray.route).toBeNull();

    // Alongside the umbrella it is an extra flat label; the route is unchanged.
    const blue = card(state({ onDoxyPep: true }), "robin");
    expect(blue.state).toBe("blue");
    expect(blue.labels).toEqual(["hiv", "doxy_pep"]);
    expect(blue.route).toBe("hiv");
  });
});

const aliasRecord = (over: Partial<AliasRecord> = {}): AliasRecord => ({
  id: "Z".repeat(43),
  writeToken: "W".repeat(43),
  key: "K".repeat(43),
  isPublic: false,
  ...over,
});

describe("resolveCardIdentity (doc 15 per-alias face)", () => {
  it("with no override: id-derived pseudonym handle and no avatar (anonymous)", () => {
    const r = aliasRecord();
    expect(resolveCardIdentity(r)).toEqual({ handle: pseudonymFor(r.id) });
  });

  it("with a handle override: shows it, still no avatar", () => {
    expect(resolveCardIdentity(aliasRecord({ handle: "meow" }))).toEqual({
      handle: "meow",
    });
  });

  it("with both overrides: shows the chosen handle and avatar", () => {
    const avatar = { animal: 1, color: 2, hat: 0, glasses: 1, extra: 0 };
    expect(
      resolveCardIdentity(aliasRecord({ handle: "meow", avatar })),
    ).toEqual({ handle: "meow", avatar });
  });
});

describe("deriveAliasCard (badge + per-alias face)", () => {
  it("anonymous alias: badge plus the id-derived pseudonym, no avatar", () => {
    const r = aliasRecord();
    expect(deriveAliasCard(state(), r, NOW_DAY)).toEqual({
      state: "blue",
      labels: ["hiv"],
      route: "hiv",
      identity: { handle: pseudonymFor(r.id) },
    });
  });

  it("override alias: carries the chosen handle and avatar (with rendered src)", () => {
    const avatar = { animal: 1, color: 2, hat: 0, glasses: 1, extra: 0 };
    const r = aliasRecord({ handle: "meow", avatar });
    expect(deriveAliasCard(state(), r, NOW_DAY)).toEqual({
      state: "blue",
      labels: ["hiv"],
      route: "hiv",
      identity: { handle: "meow" },
      avatar,
      avatarSrc: avatarSrc(avatar),
    });
  });
});

describe("withIdentity (mint-time identity choice, doc 15)", () => {
  const account = { handle: "robin", avatar: DEFAULT_AVATAR };

  it("anonymous leaves the record unchanged (id-derived face)", () => {
    const r = aliasRecord();
    expect(withIdentity(r, "anonymous", account)).toBe(r);
  });

  it("main stamps the account handle + avatar onto the record", () => {
    const r = aliasRecord();
    expect(withIdentity(r, "main", account)).toEqual({
      ...r,
      handle: "robin",
      avatar: DEFAULT_AVATAR,
    });
  });

  it("is deterministic: card built from a stamped record shows the main face", () => {
    const r = aliasRecord();
    const stamped = withIdentity(r, "main", account);
    expect(deriveAliasCard(state(), stamped, NOW_DAY).identity.handle).toBe(
      "robin",
    );
    // Anonymous instead resolves to the id-derived pseudonym.
    expect(deriveAliasCard(state(), r, NOW_DAY).identity.handle).toBe(
      pseudonymFor(r.id),
    );
  });
});

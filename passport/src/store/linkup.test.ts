// The in-person linkup codec (doc 25): offers round-trip with their badge
// snapshot, scanned text classifies strictly (offer / viewable link / null), and
// the snapshot is honored only on the day it was asserted. A scanned code is
// untrusted input, so the failure paths matter as much as the round-trip.
import { describe, expect, it } from "vitest";

import { contactInviteUrl } from "./contactInvite.ts";
import {
  freshSnapshotBadge,
  offerUrlWithBadge,
  parseScannedConnect,
} from "./linkup.ts";
import { mintNotify } from "./notifyInbox.ts";
import { randomAliasId, randomWriteToken } from "../crypto/index.ts";
import type { AliasRecord } from "./accountBlob.ts";

const DAY = 20_600;

function record(): AliasRecord {
  return {
    id: randomAliasId(),
    writeToken: randomWriteToken(),
    key: randomAliasId(),
    isPublic: false,
  };
}

function offerUrl(extras: { ref?: string; sharedName?: string } = {}): string {
  return offerUrlWithBadge(contactInviteUrl(record(), mintNotify(), extras), {
    badge: "blue",
    day: DAY,
  });
}

describe("parseScannedConnect", () => {
  it("classifies an offer and round-trips its badge snapshot", () => {
    const rec = record();
    const notify = mintNotify();
    const url = offerUrlWithBadge(contactInviteUrl(rec, notify), {
      badge: "blue",
      day: DAY,
    });
    const scanned = parseScannedConnect(url);
    expect(scanned?.kind).toBe("offer");
    if (scanned?.kind !== "offer") return;
    expect(scanned.invite.alias).toEqual({ id: rec.id, key: rec.key });
    expect(scanned.invite.notify).toEqual(notify);
    expect(scanned.snapshot).toEqual({ badge: "blue", day: DAY });
  });

  it("carries the sharedName a named offer includes", () => {
    const scanned = parseScannedConnect(offerUrl({ sharedName: "Sam" }));
    expect(scanned?.kind === "offer" && scanned.invite.sharedName).toBe("Sam");
  });

  it("treats an offer with a malformed snapshot as an offer without one", () => {
    const url = `${contactInviteUrl(record(), mintNotify())}&b=blue.later`;
    const scanned = parseScannedConnect(url);
    expect(scanned?.kind).toBe("offer");
    expect(scanned?.kind === "offer" && scanned.snapshot).toBeNull();
  });

  it("classifies a plain keyed alias link as viewable, not an offer", () => {
    const rec = record();
    const scanned = parseScannedConnect(
      `https://sti.care/a/${rec.id}#k=${rec.key}`,
    );
    expect(scanned).toEqual({
      kind: "link",
      link: { id: rec.id, key: rec.key },
    });
  });

  it("routes a RETURN invite (ref set) to the view flow, never an offer", () => {
    const scanned = parseScannedConnect(offerUrl({ ref: randomAliasId() }));
    expect(scanned?.kind).toBe("link");
  });

  it("fails closed on junk, non-URLs, and non-passport links", () => {
    expect(parseScannedConnect("not a url")).toBeNull();
    expect(parseScannedConnect("https://sti.care/g#g=zzz")).toBeNull();
    expect(parseScannedConnect("https://evil.example/a/short#k=x")).toBeNull();
  });
});

describe("freshSnapshotBadge", () => {
  it("honors a same-day snapshot and nothing else", () => {
    expect(freshSnapshotBadge({ badge: "blue", day: DAY }, DAY)).toBe("blue");
    expect(freshSnapshotBadge({ badge: "blue", day: DAY - 1 }, DAY)).toBeNull();
    expect(freshSnapshotBadge({ badge: "blue", day: DAY + 1 }, DAY)).toBeNull();
    expect(freshSnapshotBadge(null, DAY)).toBeNull();
  });
});

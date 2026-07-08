// The in-person linkup codec (doc 25): offers round-trip with their badge
// snapshot, scanned text classifies strictly (offer / viewable link / null), and
// the snapshot is honored only on the day it was asserted. A scanned code is
// untrusted input, so the failure paths matter as much as the round-trip.
import { describe, expect, it } from "vitest";

import { contactInviteUrl } from "./contactInvite.ts";
import {
  doorUrl,
  encodeDoorGrant,
  encodeDoorReturn,
  freshSnapshotBadge,
  offerUrlWithBadge,
  parseDoorGrant,
  parseDoorReturn,
  parseScannedConnect,
} from "./linkup.ts";
import { mintInbox, mintNotify } from "./notifyInbox.ts";
import { utf8ToBytes } from "../crypto/index.ts";
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

  it("the snapshot is the discriminator: a remote invite routes as a code", () => {
    // A contact invite without `b=` was printed or messaged, not shown in
    // person: it must route exactly like OPENING the link (the accept flow,
    // which sends a return), never silently half-link as an offer.
    const rec = record();
    const notify = mintNotify();
    const scanned = parseScannedConnect(contactInviteUrl(rec, notify));
    expect(scanned?.kind).toBe("code");
    if (scanned?.kind !== "code") return;
    expect(scanned.code.link).toEqual({ id: rec.id, key: rec.key });
    expect(scanned.code.invite?.notify).toEqual(notify);
    // A malformed snapshot is not a snapshot: same routing.
    const malformed = parseScannedConnect(
      `${contactInviteUrl(record(), mintNotify())}&b=blue.later`,
    );
    expect(malformed?.kind).toBe("code");
  });

  it("classifies a plain keyed alias link as a viewable code", () => {
    const rec = record();
    const scanned = parseScannedConnect(
      `https://sti.care/a/${rec.id}#k=${rec.key}`,
    );
    expect(scanned).toEqual({
      kind: "code",
      code: { link: { id: rec.id, key: rec.key } },
    });
  });

  it("routes a RETURN invite (ref set) as a code carrying its ref", () => {
    const ref = randomAliasId();
    const scanned = parseScannedConnect(offerUrl({ ref }));
    expect(scanned?.kind).toBe("code");
    expect(scanned?.kind === "code" && scanned.code.invite?.ref).toBe(ref);
  });

  it("fails closed on junk, non-URLs, and non-passport links", () => {
    expect(parseScannedConnect("not a url")).toBeNull();
    expect(parseScannedConnect("https://sti.care/g#g=zzz")).toBeNull();
    expect(parseScannedConnect("https://evil.example/a/short#k=x")).toBeNull();
  });
});

describe("door codec", () => {
  it("classifies a door code and rejects a malformed pointer", () => {
    const pointerId = randomAliasId();
    expect(parseScannedConnect(doorUrl(pointerId))).toEqual({
      kind: "door",
      pointerId,
    });
    expect(parseScannedConnect("https://sti.care/d#p=short")).toBeNull();
    expect(parseScannedConnect("https://sti.care/d")).toBeNull();
  });

  it("round-trips a door grant and fails closed on garbage", () => {
    const grant = {
      invite: {
        alias: { id: randomAliasId(), key: randomAliasId() },
        notify: mintNotify(),
        sharedName: "Sam",
      },
      returnInbox: mintInbox(),
    };
    expect(parseDoorGrant(encodeDoorGrant(grant))).toEqual(grant);
    expect(parseDoorGrant(utf8ToBytes("junk"))).toBeNull();
    expect(parseDoorGrant(utf8ToBytes(`{"alias":{"id":"x"}}`))).toBeNull();
  });

  it("accepts only a RETURN invite as a door answer", () => {
    const ref = randomAliasId();
    const ret = contactInviteUrl(record(), mintNotify(), { ref });
    expect(parseDoorReturn(encodeDoorReturn(ret))?.ref).toBe(ref);
    // An offer (no ref) or garbage written into the inbox is never ingested.
    const bare = contactInviteUrl(record(), mintNotify());
    expect(parseDoorReturn(encodeDoorReturn(bare))).toBeNull();
    expect(parseDoorReturn(utf8ToBytes("junk"))).toBeNull();
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

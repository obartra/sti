// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  composeNotifyDraft,
  lockNotifyDraft,
  encodePartnerPing,
  parsePartnerPing,
  NOTIFY_DEFAULT_LOOKBACK_DAYS,
} from "./partnerNotify.ts";
import { mintNotify } from "./notifyInbox.ts";
import type { AccountBlob, ContactRecord } from "./accountBlob.ts";
import type { ApiClient } from "../api/client.ts";
import { INITIAL_OWNER_STATE } from "../core/badge.ts";
import { DEFAULT_AVATAR } from "../lib/avatars.ts";
import {
  randomAliasId,
  randomWriteToken,
  bytesToBase64url,
  utf8ToBytes,
  type Bytes,
} from "../crypto/index.ts";

function aliasRecord() {
  return {
    id: randomAliasId(),
    writeToken: randomWriteToken(),
    key: bytesToBase64url(crypto.getRandomValues(new Uint8Array(32))),
    isPublic: false,
  };
}

function contact(
  label: string,
  createdDay: number,
  notifiable: boolean,
): ContactRecord {
  const base = {
    id: randomAliasId(),
    label,
    createdDay,
    expiresAt: null,
    alias: aliasRecord(),
  };
  return notifiable ? { ...base, theirNotify: mintNotify() } : base;
}

function blobWith(contacts: ContactRecord[]): AccountBlob {
  return {
    handle: "robin",
    aliases: [],
    contacts,
    state: INITIAL_OWNER_STATE,
    avatar: DEFAULT_AVATAR,
    sharingMode: "link",
  };
}

// A fake api exposing only putInbox + notify; putInbox rejects for a poison inbox
// id so we can exercise the per-contact failed path. Everything else is unused.
function fakeApi(poisonInboxId?: string): {
  api: ApiClient;
  pings: Map<string, { payload: Bytes; writeToken: string }>;
  notified: string[];
} {
  const pings = new Map<string, { payload: Bytes; writeToken: string }>();
  const notified: string[] = [];
  const unused = () => {
    throw new Error("not used in partner-notify tests");
  };
  const api: ApiClient = {
    putInbox(id, payload, writeToken) {
      if (id === poisonInboxId) {
        return Promise.reject(new Error("inbox write failed"));
      }
      pings.set(id, { payload, writeToken });
      return Promise.resolve();
    },
    notify(tokenHash) {
      notified.push(tokenHash);
      return Promise.resolve();
    },
    getInbox: unused,
    getAlias: unused,
    putAlias: unused,
    getAccount: unused,
    putAccount: unused,
    deleteAccount: unused,
    republish: unused,
    knock: unused,
    knockCount: unused,
    knockReview: unused,
    registerPush: unused,
    getVapidPublicKey: unused,
    registerVanityName: unused,
    releaseVanityName: unused,
    resolveVanityName: unused,
    reportVanityName: unused,
    getRecoveryEnvelope: unused,
    putRecoveryEnvelope: unused,
    deleteRecoveryEnvelope: unused,
    health: unused,
  };
  return { api, pings, notified };
}

describe("partner-notify ping codec", () => {
  it("round-trips a contentless partner-notify ping", () => {
    const ping = parsePartnerPing(encodePartnerPing());
    expect(ping?.kind).toBe("partner-notify");
    // The contentlessness promise lives here: the bytes on the wire carry ONLY a
    // version and a fixed kind marker, never a who/when/what field. Pin the exact
    // key set so adding any field (an id, a name, a timestamp, a condition) fails
    // the build, not just a round-trip that would still pass with extra keys.
    const onWire = JSON.parse(
      new TextDecoder().decode(encodePartnerPing()),
    ) as Record<string, unknown>;
    expect(Object.keys(onWire).sort()).toEqual(["kind", "v"]);
  });

  it("rejects garbage and a wrong version/kind", () => {
    expect(parsePartnerPing(utf8ToBytes("not json"))).toBeNull();
    expect(parsePartnerPing(utf8ToBytes(JSON.stringify({ v: 99 })))).toBeNull();
    expect(
      parsePartnerPing(utf8ToBytes(JSON.stringify({ v: 1, kind: "other" }))),
    ).toBeNull();
  });
});

describe("composeNotifyDraft", () => {
  it("seeds notifiable contacts inside the window, newest first", () => {
    const blob = blobWith([
      contact("recent", 100, true),
      contact("older", 90, true),
      contact("not-notifiable", 99, false), // no theirNotify -> excluded
      contact("out-of-window", 1, true), // too old -> excluded
    ]);
    const draft = composeNotifyDraft(blob, 100, 30); // window: day >= 70

    expect(draft.entries.map((e) => e.label)).toEqual(["recent", "older"]);
    expect(draft.createdDay).toBe(100);
  });

  it("defaults the lookback to the partner-notify window", () => {
    const blob = blobWith([
      contact("in", 100 - NOTIFY_DEFAULT_LOOKBACK_DAYS, true),
      contact("out", 100 - NOTIFY_DEFAULT_LOOKBACK_DAYS - 1, true),
    ]);
    expect(composeNotifyDraft(blob, 100).entries.map((e) => e.label)).toEqual([
      "in",
    ]);
  });
});

describe("lockNotifyDraft", () => {
  it("writes a ping and queues a wake for each notifiable contact", async () => {
    const notifiable = contact("a", 100, true);
    const { api, pings, notified } = fakeApi();
    const blob = blobWith([notifiable]);

    const result = await lockNotifyDraft(api, blob, [notifiable.id]);

    expect(result.sent).toEqual([notifiable.id]);
    expect(result.skipped).toEqual([]);
    expect(result.failed).toEqual([]);
    // The ping landed in the contact's inbox under its own write token, and a wake
    // was posted.
    const cap = notifiable.theirNotify;
    if (cap === undefined) throw new Error("expected a notify capability");
    expect(pings.get(cap.inboxId)?.writeToken).toBe(cap.writeToken);
    expect(notified).toHaveLength(1);
  });

  it("skips an unknown id and a contact with no notify capability", async () => {
    const plain = contact("no-cap", 100, false);
    const { api, notified } = fakeApi();
    const blob = blobWith([plain]);

    const result = await lockNotifyDraft(api, blob, [plain.id, "missing-id"]);

    expect(result.sent).toEqual([]);
    expect(result.skipped.sort()).toEqual([plain.id, "missing-id"].sort());
    expect(notified).toHaveLength(0);
  });

  it("records a failed ping write without aborting the rest of the batch", async () => {
    const good = contact("good", 100, true);
    const bad = contact("bad", 100, true);
    // Poison the bad contact's inbox so its write throws.
    const { api, notified } = fakeApi(bad.theirNotify?.inboxId);
    const blob = blobWith([good, bad]);

    const result = await lockNotifyDraft(api, blob, [bad.id, good.id]);

    expect(result.failed).toEqual([bad.id]);
    expect(result.sent).toEqual([good.id]);
    // The good contact was still woken; the failed one was not.
    expect(notified).toHaveLength(1);
  });

  it("does not let a failed wake undo a delivered ping", async () => {
    const notifiable = contact("a", 100, true);
    const { api, pings } = fakeApi();
    const failingNotify: ApiClient = {
      ...api,
      notify: () => Promise.reject(new Error("notify gateway down")),
    };
    const blob = blobWith([notifiable]);

    const result = await lockNotifyDraft(failingNotify, blob, [notifiable.id]);

    // The ping is the source of truth: it is delivered and counted as sent even
    // though the (best-effort) wake failed.
    expect(result.sent).toEqual([notifiable.id]);
    const inboxId = notifiable.theirNotify?.inboxId;
    expect(inboxId !== undefined && pings.has(inboxId)).toBe(true);
  });

  it("dedupes a contact listed twice so it is notified once", async () => {
    const notifiable = contact("a", 100, true);
    const { api, notified } = fakeApi();
    const blob = blobWith([notifiable]);

    const result = await lockNotifyDraft(api, blob, [
      notifiable.id,
      notifiable.id,
    ]);

    expect(result.sent).toEqual([notifiable.id]);
    expect(notified).toHaveLength(1);
  });
});

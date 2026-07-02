// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  groupInviteUrl,
  parseGroupInvite,
  encodeLifecycleAccept,
  encodeLifecycleReject,
  encodeLifecycleLeave,
  parseLifecyclePayload,
  encodeJoinGrant,
  parseJoinGrant,
  type GroupInvite,
} from "./groupInvite.ts";
import { mintInbox, writePing, pollInbox } from "./notifyInbox.ts";
import type { ApiClient } from "../api/client.ts";
import { ALIAS_PAYLOAD_SIZE } from "../api/contract.ts";
import {
  randomAliasId,
  base64urlToBytes,
  bytesToBase64url,
  type Bytes,
} from "../crypto/index.ts";

function invite(): GroupInvite {
  return {
    groupId: randomAliasId(),
    lifecycleInbox: mintInbox(),
    handle: "book_club",
    visibility: "public",
    meetingKind: "recurring",
  };
}

// Split a built URL into the pathname + hash the parser consumes.
function parts(url: string): { pathname: string; hash: string } {
  const u = new URL(url);
  return { pathname: u.pathname, hash: u.hash };
}

// A one-inbox in-memory server: getInbox returns the stored bytes, or a random decoy
// on a miss (existence-uniform, exactly like the real server).
function fakeInboxApi(): ApiClient {
  const store = new Map<string, Bytes>();
  const unused = () => {
    throw new Error("not used in this test");
  };
  return {
    getInbox: (id) =>
      Promise.resolve(
        store.get(id) ??
          crypto.getRandomValues(new Uint8Array(ALIAS_PAYLOAD_SIZE)),
      ),
    putInbox: (id, payload) => {
      store.set(id, payload);
      return Promise.resolve();
    },
    getAlias: unused,
    putAlias: unused,
    getAccount: unused,
    putAccount: unused,
    deleteAccount: unused,
    notify: unused,
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
    submitFeedback: unused,
    getRecoveryEnvelope: unused,
    putRecoveryEnvelope: unused,
    deleteRecoveryEnvelope: unused,
    getGroupBlob: unused,
    putGroupBlob: unused,
    deleteGroupBlob: unused,
    health: unused,
  };
}

describe("group invite URL codec (doc 33)", () => {
  it("round-trips the invite (all fields in the fragment)", () => {
    const inv = invite();
    const { pathname, hash } = parts(groupInviteUrl(inv));
    expect(parseGroupInvite(pathname, hash)).toEqual(inv);
  });

  it("keeps everything in the fragment (nothing reaches the server path)", () => {
    const { pathname, hash } = parts(groupInviteUrl(invite()));
    // The path carries no id; all capabilities ride the `#` fragment.
    expect(pathname).toBe("/g");
    expect(hash.startsWith("#g=")).toBe(true);
  });

  it("fails closed on a garbage fragment", () => {
    expect(parseGroupInvite("/g", "#g=@@@")).toBeNull();
    expect(parseGroupInvite("/g", "#nope")).toBeNull();
  });

  it("fails closed on a tampered (well-encoded but invalid) fragment", () => {
    const inv = invite();
    const { hash } = parts(groupInviteUrl(inv));
    // Decode, corrupt the groupId to a non-id shape, re-encode.
    const g = new URLSearchParams(hash.replace(/^#/, "")).get("g") ?? "";
    const o = JSON.parse(
      new TextDecoder().decode(base64urlToBytes(g)),
    ) as Record<string, unknown>;
    o.groupId = "short";
    const tampered = bytesToBase64url(
      new TextEncoder().encode(JSON.stringify(o)),
    );
    expect(parseGroupInvite("/g", `#g=${tampered}`)).toBeNull();
  });

  it("fails closed on the wrong path", () => {
    const { hash } = parts(groupInviteUrl(invite()));
    expect(parseGroupInvite("/a/xyz", hash)).toBeNull();
  });
});

describe("group lifecycle payload codec (doc 33)", () => {
  it("round-trips an accept and a reject (pure)", () => {
    const memberKey = crypto.getRandomValues(new Uint8Array(32));
    const cardId = randomAliasId();
    expect(
      parseLifecyclePayload(encodeLifecycleAccept(memberKey, cardId)),
    ).toEqual({
      kind: "accept",
      memberKey: bytesToBase64url(memberKey),
      cardId,
    });
    expect(parseLifecyclePayload(encodeLifecycleReject())).toEqual({
      kind: "reject",
    });
  });

  it("round-trips a leave (doc 33, slice 4b)", () => {
    expect(parseLifecyclePayload(encodeLifecycleLeave())).toEqual({
      kind: "leave",
    });
  });

  it("a wrong inbox key fails a leave closed to null", async () => {
    const api = fakeInboxApi();
    const inbox = mintInbox();
    await writePing(api, inbox, encodeLifecycleLeave());
    const wrong = { inboxId: inbox.inboxId, key: mintInbox().key };
    expect(await pollInbox(api, wrong)).toBeNull();
  });

  it("fails closed on garbage", () => {
    expect(
      parseLifecyclePayload(new TextEncoder().encode("not json")),
    ).toBeNull();
    expect(
      parseLifecyclePayload(
        new TextEncoder().encode(JSON.stringify({ kind: "x" })),
      ),
    ).toBeNull();
    expect(
      parseLifecyclePayload(
        new TextEncoder().encode(
          JSON.stringify({ kind: "accept", cardId: "y" }),
        ),
      ),
    ).toBeNull();
  });

  it("seals an accept through the inbox and opens it back", async () => {
    const api = fakeInboxApi();
    const inbox = mintInbox();
    const memberKey = crypto.getRandomValues(new Uint8Array(32));
    const cardId = randomAliasId();
    await writePing(api, inbox, encodeLifecycleAccept(memberKey, cardId));

    const raw = await pollInbox(api, inbox);
    if (raw === null) throw new Error("expected a ping");
    expect(parseLifecyclePayload(raw)).toEqual({
      kind: "accept",
      memberKey: bytesToBase64url(memberKey),
      cardId,
    });
  });

  it("a wrong inbox key fails closed to null", async () => {
    const api = fakeInboxApi();
    const inbox = mintInbox();
    await writePing(api, inbox, encodeLifecycleReject());
    // Poll with a different key: the AEAD open fails, so it reads as empty.
    const wrong = { inboxId: inbox.inboxId, key: mintInbox().key };
    expect(await pollInbox(api, wrong)).toBeNull();
  });
});

describe("join-grant payload codec (doc 33, slice 4b)", () => {
  it("round-trips an invite (the same fields the URL carries)", () => {
    const inv = invite();
    expect(parseJoinGrant(encodeJoinGrant(inv))).toEqual(inv);
  });

  it("fails closed on garbage or a tampered payload", () => {
    expect(parseJoinGrant(new TextEncoder().encode("not json"))).toBeNull();
    // A well-encoded but invalid shape (a non-id groupId) fails closed too.
    expect(
      parseJoinGrant(
        new TextEncoder().encode(JSON.stringify({ groupId: "short" })),
      ),
    ).toBeNull();
  });
});

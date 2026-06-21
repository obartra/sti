// @vitest-environment node
import { describe, it, expect } from "vitest";
import { contactInviteUrl, parseContactInvite } from "./contactInvite.ts";
import { keyedAliasLinkUrl } from "./publish.ts";
import { mintNotify } from "./notifyInbox.ts";
import type { AliasRecord } from "./accountBlob.ts";
import {
  randomAliasId,
  randomWriteToken,
  bytesToBase64url,
} from "../crypto/index.ts";

function aliasRecord(): AliasRecord {
  return {
    id: randomAliasId(),
    writeToken: randomWriteToken(),
    key: bytesToBase64url(crypto.getRandomValues(new Uint8Array(32))),
    isPublic: false,
  };
}

// Split a built URL into the pathname + hash that the parser consumes.
function parts(url: string): { pathname: string; hash: string } {
  const u = new URL(url);
  return { pathname: u.pathname, hash: u.hash };
}

describe("contact invite codec", () => {
  it("round-trips the inviter's alias + notify capability", () => {
    const record = aliasRecord();
    const notify = mintNotify();
    const { pathname, hash } = parts(contactInviteUrl(record, notify));
    expect(parseContactInvite(pathname, hash)).toEqual({
      alias: { id: record.id, key: record.key },
      notify,
    });
  });

  it("carries ref on a return invite and round-trips it", () => {
    const record = aliasRecord();
    const notify = mintNotify();
    const ref = randomAliasId();
    const { pathname, hash } = parts(contactInviteUrl(record, notify, ref));
    expect(parseContactInvite(pathname, hash)).toEqual({
      alias: { id: record.id, key: record.key },
      notify,
      ref,
    });
  });

  it("a plain alias link (no notify) is not an invite", () => {
    const { pathname, hash } = parts(keyedAliasLinkUrl(aliasRecord()));
    expect(parseContactInvite(pathname, hash)).toBeNull();
  });

  it("fails closed on a garbage or malformed notify capability", () => {
    const record = aliasRecord();
    const base = keyedAliasLinkUrl(record);
    // Not base64url-decodable JSON.
    const garbage = parts(`${base}&n=@@@`);
    expect(parseContactInvite(garbage.pathname, garbage.hash)).toBeNull();
    // Valid base64url JSON but missing a capability field.
    const bad = bytesToBase64url(
      new TextEncoder().encode(
        JSON.stringify({ inboxId: record.id, writeToken: record.id }),
      ),
    );
    const malformed = parts(`${base}&n=${bad}`);
    expect(parseContactInvite(malformed.pathname, malformed.hash)).toBeNull();
  });

  it("rejects a malformed ref", () => {
    const record = aliasRecord();
    const notify = mintNotify();
    const url = `${contactInviteUrl(record, notify)}&ref=short`;
    const { pathname, hash } = parts(url);
    expect(parseContactInvite(pathname, hash)).toBeNull();
  });
});

// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  contactInviteUrl,
  parseContactInvite,
  parseScannedCode,
} from "./contactInvite.ts";
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
    const { pathname, hash } = parts(contactInviteUrl(record, notify, { ref }));
    expect(parseContactInvite(pathname, hash)).toEqual({
      alias: { id: record.id, key: record.key },
      notify,
      ref,
    });
  });

  it("carries a shared name and round-trips it as a label seed", () => {
    const record = aliasRecord();
    const notify = mintNotify();
    const { pathname, hash } = parts(
      contactInviteUrl(record, notify, { sharedName: "robin" }),
    );
    expect(parseContactInvite(pathname, hash)).toEqual({
      alias: { id: record.id, key: record.key },
      notify,
      sharedName: "robin",
    });
  });

  it("drops a malformed shared name but still parses the invite", () => {
    const record = aliasRecord();
    const notify = mintNotify();
    // A non-base64url `sn` value: the invite still resolves, just without a seed.
    const url = `${contactInviteUrl(record, notify)}&sn=@@@`;
    const { pathname, hash } = parts(url);
    expect(parseContactInvite(pathname, hash)).toEqual({
      alias: { id: record.id, key: record.key },
      notify,
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

// Scanning a code must behave like OPENING the same link: the alias link always,
// plus the invite payload when the code is one. Same fail-closed posture as
// parseScannedLink for everything else (junk, non-links, keyless, group invites).
describe("parseScannedCode", () => {
  it("a plain alias link scans to a link with no invite", () => {
    const record = aliasRecord();
    expect(parseScannedCode(keyedAliasLinkUrl(record))).toEqual({
      link: { id: record.id, key: record.key },
    });
  });

  it("a contact invite scans with its notify capability intact", () => {
    const record = aliasRecord();
    const notify = mintNotify();
    expect(parseScannedCode(contactInviteUrl(record, notify))).toEqual({
      link: { id: record.id, key: record.key },
      invite: { alias: { id: record.id, key: record.key }, notify },
    });
  });

  it("a return invite scans with its ref intact", () => {
    const record = aliasRecord();
    const notify = mintNotify();
    const ref = randomAliasId();
    const scanned = parseScannedCode(contactInviteUrl(record, notify, { ref }));
    expect(scanned?.invite?.ref).toBe(ref);
  });

  it("a malformed invite payload falls back to a plain link, like opening it", () => {
    const record = aliasRecord();
    const url = `${keyedAliasLinkUrl(record)}&n=@@@`;
    expect(parseScannedCode(url)).toEqual({
      link: { id: record.id, key: record.key },
    });
  });

  it("fails closed on junk, non-links, keyless links, and group invites", () => {
    expect(parseScannedCode("not a url")).toBeNull();
    expect(parseScannedCode("https://sti.care/exposed")).toBeNull();
    expect(
      parseScannedCode(`https://sti.care/a/${randomAliasId()}`),
    ).toBeNull();
    expect(parseScannedCode("https://sti.care/g#g=abc")).toBeNull();
  });
});

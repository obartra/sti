// @vitest-environment node
import { describe, it, expect } from "vitest";
import { phraseForTest, rootForTest } from "../test-support/phrase.ts";
import {
  randomAliasId,
  randomWriteToken,
  randomRecoveryPhrase,
  parseRecoveryPhrase,
  deriveRootKey,
  deriveAccountId,
  deriveAccountKey,
  deriveAccountWriteToken,
  deriveGroupNotify,
  wrapKeyFromPrf,
} from "./keys.ts";
import { importAesKey, seal, open } from "./payload.ts";
import { utf8ToBytes, bytesToUtf8 } from "./encoding.ts";
import { mintGroupKey } from "../store/groupCrypto.ts";

describe("random ids", () => {
  it("alias ids are 43-char base64url and unique", () => {
    const a = randomAliasId();
    const b = randomAliasId();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });

  it("write tokens look like ids but are a separate draw from alias ids", () => {
    const id = randomAliasId();
    const token = randomWriteToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(token).not.toBe(id);
  });

  it("recovery phrases are app-generated 256-bit secrets, unique per draw", () => {
    // 43-char base64url == 32 random bytes == 256 bits. The blind-store guarantee
    // for the passphrase path rests on the phrase being app-generated and
    // high-entropy (never user-chosen), so this pins that shape.
    const phrases = new Set(
      Array.from({ length: 50 }, () => randomRecoveryPhrase()),
    );
    expect(phrases.size).toBe(50); // no collisions across draws
    for (const p of phrases) expect(p).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("parseRecoveryPhrase accepts the app format and rejects anything else", () => {
    // The KDF uses a fixed salt, safe ONLY for app-generated high-entropy phrases.
    // Recovery routes user input through here so a low-entropy / malformed phrase
    // fails closed instead of deriving a key from arbitrary text.
    expect(parseRecoveryPhrase(randomRecoveryPhrase())).not.toBeNull();
    expect(parseRecoveryPhrase("  " + "A".repeat(43) + "  ")).not.toBeNull(); // trims
    for (const bad of [
      "",
      "hunter2",
      "short",
      "A".repeat(42),
      "A".repeat(44),
      "!".repeat(43),
    ]) {
      expect(parseRecoveryPhrase(bad)).toBeNull();
    }
  });
});

describe("root key + account derivation", () => {
  it("derives the same root key for the same passphrase", async () => {
    const a = await deriveRootKey(
      phraseForTest("correct horse battery staple"),
    );
    const b = await deriveRootKey(
      phraseForTest("correct horse battery staple"),
    );
    expect(a).toEqual(b);
    expect(a).toHaveLength(32);
  });

  it("a different passphrase yields a different root key", async () => {
    const a = await deriveRootKey(phraseForTest("passphrase one"));
    const b = await deriveRootKey(phraseForTest("passphrase two"));
    expect(a).not.toEqual(b);
  });

  it("account id is deterministic, 43-char, and recoverable from the key alone", async () => {
    const root = await rootForTest("recovery");
    const id1 = await deriveAccountId(root);
    const id2 = await deriveAccountId(root);
    expect(id1).toBe(id2);
    expect(id1).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("account id and account key are distinct derivations from the same root", async () => {
    const root = await rootForTest("recovery");
    const id = await deriveAccountId(root);
    const key = await deriveAccountKey(root);
    expect(key).toHaveLength(32);
    // The id must not equal the raw key material, even encoded.
    expect(id).not.toBe(Buffer.from(key).toString("base64url"));
  });

  // The account write token is the SECOND FACTOR that gates overwrite/delete of the
  // account blob: the id travels on the wire, the token does not, so a leaked id
  // alone cannot clobber the account. The whole guarantee rests on the token being an
  // independent derivation, never equal to the id (or the blob key). An accidental
  // info-label collapse would silently defeat it, so pin it here.
  it("account write token is deterministic, 43-char, and independent of the id and key", async () => {
    const root = await rootForTest("recovery");
    const t1 = await deriveAccountWriteToken(root);
    const t2 = await deriveAccountWriteToken(root);
    expect(t1).toBe(t2); // deterministic, recoverable from the root alone
    expect(t1).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const id = await deriveAccountId(root);
    const key = await deriveAccountKey(root);
    expect(t1).not.toBe(id); // never equal to the on-wire id (the second factor)
    expect(t1).not.toBe(Buffer.from(key).toString("base64url"));

    // A different account (different root) yields a different token.
    const other = await rootForTest("different");
    expect(await deriveAccountWriteToken(other)).not.toBe(t1);
  });

  it("the derived account key actually decrypts a blob sealed under it", async () => {
    const root = await rootForTest("recovery");
    const aesKey = await importAesKey(await deriveAccountKey(root));
    const blob = utf8ToBytes(JSON.stringify({ aliases: [], circles: [] }));
    const ct = await seal(aesKey, blob);
    expect(bytesToUtf8(await open(aesKey, ct))).toBe(bytesToUtf8(blob));
  });

  it("derives a stable 32-byte wrapping key from a passkey PRF output", async () => {
    const prf = crypto.getRandomValues(new Uint8Array(32));
    const a = await wrapKeyFromPrf(prf);
    const b = await wrapKeyFromPrf(prf);
    expect(a).toEqual(b);
    expect(a).toHaveLength(32);
    const other = await wrapKeyFromPrf(
      crypto.getRandomValues(new Uint8Array(32)),
    );
    expect(a).not.toEqual(other);
  });

  it("a root from a wrong passphrase cannot open the blob (recovery is key-bound)", async () => {
    const right = await importAesKey(
      await deriveAccountKey(await rootForTest("right")),
    );
    const wrong = await importAesKey(
      await deriveAccountKey(await rootForTest("wrong")),
    );
    const ct = await seal(right, utf8ToBytes("device blob"));
    await expect(open(wrong, ct)).rejects.toThrow();
  });
});

// The group-notify channel (doc 33, slice 6) derives PURELY from the shared group key
// Kg + a co-member's public cardId, so every member can reach every co-member without
// a pairwise link. The whole no-new-oracle guarantee rests on the four labels being
// independent HKDF outputs (the wire ids never equal the key that seals the ping), so
// pin that here exactly like the account id/key/write-token independence above.
describe("deriveGroupNotify (doc 33, slice 6)", () => {
  const ID_RE = /^[A-Za-z0-9_-]{43}$/;

  it("is deterministic for the same Kg + cardId", async () => {
    const Kg = mintGroupKey();
    const cardId = randomAliasId();
    const a = await deriveGroupNotify(Kg, cardId);
    const b = await deriveGroupNotify(Kg, cardId);
    expect(a).toEqual(b); // recoverable by both reporter and recipient
  });

  it("all four tokens are distinct 43-char base64url ids", async () => {
    const cap = await deriveGroupNotify(mintGroupKey(), randomAliasId());
    const tokens = [cap.inboxId, cap.writeToken, cap.key, cap.routingToken];
    for (const t of tokens) expect(t).toMatch(ID_RE);
    // Independent labels: the on-wire ids must never equal the sealing key.
    expect(new Set(tokens).size).toBe(4);
  });

  it("a different cardId yields a different channel under the same Kg", async () => {
    const Kg = mintGroupKey();
    const a = await deriveGroupNotify(Kg, randomAliasId());
    const b = await deriveGroupNotify(Kg, randomAliasId());
    expect(a.inboxId).not.toBe(b.inboxId);
    expect(a.key).not.toBe(b.key);
  });

  it("a different Kg yields a different channel for the same cardId", async () => {
    const cardId = randomAliasId();
    const a = await deriveGroupNotify(mintGroupKey(), cardId);
    const b = await deriveGroupNotify(mintGroupKey(), cardId);
    // A rotation (fresh Kg) kills the old channel and mints a new one.
    expect(a.inboxId).not.toBe(b.inboxId);
    expect(a.key).not.toBe(b.key);
  });
});

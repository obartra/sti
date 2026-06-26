// @vitest-environment node
import { describe, it, expect } from "vitest";
import { phraseForTest, masterForTest } from "../test-support/phrase.ts";
import {
  randomAliasId,
  randomWriteToken,
  randomRecoveryPhrase,
  parseRecoveryPhrase,
  deriveMasterKey,
  deriveAccountId,
  deriveAccountKey,
  wrapKeyFromPrf,
} from "./keys.ts";
import { importAesKey, seal, open } from "./payload.ts";
import { utf8ToBytes, bytesToUtf8 } from "./encoding.ts";

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

describe("master key + account derivation", () => {
  it("derives the same master key for the same passphrase", async () => {
    const a = await deriveMasterKey(
      phraseForTest("correct horse battery staple"),
    );
    const b = await deriveMasterKey(
      phraseForTest("correct horse battery staple"),
    );
    expect(a).toEqual(b);
    expect(a).toHaveLength(32);
  });

  it("a different passphrase yields a different master key", async () => {
    const a = await deriveMasterKey(phraseForTest("passphrase one"));
    const b = await deriveMasterKey(phraseForTest("passphrase two"));
    expect(a).not.toEqual(b);
  });

  it("account id is deterministic, 43-char, and recoverable from the key alone", async () => {
    const master = await masterForTest("recovery");
    const id1 = await deriveAccountId(master);
    const id2 = await deriveAccountId(master);
    expect(id1).toBe(id2);
    expect(id1).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("account id and account key are distinct derivations from the same master", async () => {
    const master = await masterForTest("recovery");
    const id = await deriveAccountId(master);
    const key = await deriveAccountKey(master);
    expect(key).toHaveLength(32);
    // The id must not equal the raw key material, even encoded.
    expect(id).not.toBe(Buffer.from(key).toString("base64url"));
  });

  it("the derived account key actually decrypts a blob sealed under it", async () => {
    const master = await masterForTest("recovery");
    const aesKey = await importAesKey(await deriveAccountKey(master));
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

  it("a master from a wrong passphrase cannot open the blob (recovery is key-bound)", async () => {
    const right = await importAesKey(
      await deriveAccountKey(await masterForTest("right")),
    );
    const wrong = await importAesKey(
      await deriveAccountKey(await masterForTest("wrong")),
    );
    const ct = await seal(right, utf8ToBytes("device blob"));
    await expect(open(wrong, ct)).rejects.toThrow();
  });
});

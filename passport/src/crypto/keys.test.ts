// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  randomAliasId,
  randomWriteToken,
  deriveMasterKey,
  deriveAccountId,
  deriveAccountKey,
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
});

describe("master key + account derivation", () => {
  const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);

  it("derives the same master key for the same passphrase + salt", async () => {
    const a = await deriveMasterKey("correct horse battery staple", salt);
    const b = await deriveMasterKey("correct horse battery staple", salt);
    expect(a).toEqual(b);
    expect(a).toHaveLength(32);
  });

  it("a different passphrase yields a different master key", async () => {
    const a = await deriveMasterKey("passphrase one", salt);
    const b = await deriveMasterKey("passphrase two", salt);
    expect(a).not.toEqual(b);
  });

  it("a different salt yields a different master key", async () => {
    const a = await deriveMasterKey("same passphrase", salt);
    const b = await deriveMasterKey("same passphrase", new Uint8Array(8).fill(9));
    expect(a).not.toEqual(b);
  });

  it("account id is deterministic, 43-char, and recoverable from the key alone", async () => {
    const master = await deriveMasterKey("recovery", salt);
    const id1 = await deriveAccountId(master);
    const id2 = await deriveAccountId(master);
    expect(id1).toBe(id2);
    expect(id1).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("account id and account key are distinct derivations from the same master", async () => {
    const master = await deriveMasterKey("recovery", salt);
    const id = await deriveAccountId(master);
    const key = await deriveAccountKey(master);
    expect(key).toHaveLength(32);
    // The id must not equal the raw key material, even encoded.
    expect(id).not.toBe(Buffer.from(key).toString("base64url"));
  });

  it("the derived account key actually decrypts a blob sealed under it", async () => {
    const master = await deriveMasterKey("recovery", salt);
    const aesKey = await importAesKey(await deriveAccountKey(master));
    const blob = utf8ToBytes(JSON.stringify({ aliases: [], circles: [] }));
    const ct = await seal(aesKey, blob);
    expect(bytesToUtf8(await open(aesKey, ct))).toBe(bytesToUtf8(blob));
  });

  it("a master from a wrong passphrase cannot open the blob (recovery is key-bound)", async () => {
    const right = await importAesKey(
      await deriveAccountKey(await deriveMasterKey("right", salt)),
    );
    const wrong = await importAesKey(
      await deriveAccountKey(await deriveMasterKey("wrong", salt)),
    );
    const ct = await seal(right, utf8ToBytes("device blob"));
    await expect(open(wrong, ct)).rejects.toThrow();
  });
});

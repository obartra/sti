// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  randomAliasId,
  randomWriteToken,
  deriveMasterKey,
  deriveAccountId,
  deriveAccountKey,
  masterFromPrf,
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
  it("derives the same master key for the same passphrase", async () => {
    const a = await deriveMasterKey("correct horse battery staple");
    const b = await deriveMasterKey("correct horse battery staple");
    expect(a).toEqual(b);
    expect(a).toHaveLength(32);
  });

  it("a different passphrase yields a different master key", async () => {
    const a = await deriveMasterKey("passphrase one");
    const b = await deriveMasterKey("passphrase two");
    expect(a).not.toEqual(b);
  });

  it("account id is deterministic, 43-char, and recoverable from the key alone", async () => {
    const master = await deriveMasterKey("recovery");
    const id1 = await deriveAccountId(master);
    const id2 = await deriveAccountId(master);
    expect(id1).toBe(id2);
    expect(id1).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("account id and account key are distinct derivations from the same master", async () => {
    const master = await deriveMasterKey("recovery");
    const id = await deriveAccountId(master);
    const key = await deriveAccountKey(master);
    expect(key).toHaveLength(32);
    // The id must not equal the raw key material, even encoded.
    expect(id).not.toBe(Buffer.from(key).toString("base64url"));
  });

  it("the derived account key actually decrypts a blob sealed under it", async () => {
    const master = await deriveMasterKey("recovery");
    const aesKey = await importAesKey(await deriveAccountKey(master));
    const blob = utf8ToBytes(JSON.stringify({ aliases: [], circles: [] }));
    const ct = await seal(aesKey, blob);
    expect(bytesToUtf8(await open(aesKey, ct))).toBe(bytesToUtf8(blob));
  });

  it("derives a stable 32-byte master from a passkey PRF output", async () => {
    const prf = crypto.getRandomValues(new Uint8Array(32));
    const a = await masterFromPrf(prf);
    const b = await masterFromPrf(prf);
    expect(a).toEqual(b);
    expect(a).toHaveLength(32);
    const other = await masterFromPrf(
      crypto.getRandomValues(new Uint8Array(32)),
    );
    expect(a).not.toEqual(other);
  });

  it("a master from a wrong passphrase cannot open the blob (recovery is key-bound)", async () => {
    const right = await importAesKey(
      await deriveAccountKey(await deriveMasterKey("right")),
    );
    const wrong = await importAesKey(
      await deriveAccountKey(await deriveMasterKey("wrong")),
    );
    const ct = await seal(right, utf8ToBytes("device blob"));
    await expect(open(wrong, ct)).rejects.toThrow();
  });
});

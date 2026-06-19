// @vitest-environment node
// Node exposes a complete WebCrypto (crypto.subtle); jsdom's stub does not.
import { describe, it, expect } from "vitest";
import {
  importAesKey,
  seal,
  open,
  sealToSize,
  openSized,
  maxPlaintextForSize,
} from "./payload.ts";
import { utf8ToBytes, bytesToUtf8 } from "./encoding.ts";

const ALIAS_SIZE = 4096; // contract AliasPayloadSize

async function freshKey(): Promise<CryptoKey> {
  return importAesKey(crypto.getRandomValues(new Uint8Array(32)));
}

describe("variable seal/open", () => {
  it("round-trips a plaintext", async () => {
    const key = await freshKey();
    const msg = utf8ToBytes(JSON.stringify({ handle: "robin", badge: "blue" }));
    const ct = await seal(key, msg);
    expect(bytesToUtf8(await open(key, ct))).toBe(bytesToUtf8(msg));
  });

  it("rejects a wrong key", async () => {
    const ct = await seal(await freshKey(), utf8ToBytes("secret"));
    await expect(open(await freshKey(), ct)).rejects.toThrow();
  });

  it("rejects tampered ciphertext", async () => {
    const key = await freshKey();
    const ct = await seal(key, utf8ToBytes("secret"));
    const last = ct.length - 1;
    ct[last] = (ct[last] ?? 0) ^ 0x01; // flip a tag bit
    await expect(open(key, ct)).rejects.toThrow();
  });
});

describe("fixed-size seal (alias payload)", () => {
  it("always produces exactly the contract size", async () => {
    const key = await freshKey();
    for (const len of [0, 1, 100, maxPlaintextForSize(ALIAS_SIZE)]) {
      const out = await sealToSize(key, new Uint8Array(len), ALIAS_SIZE);
      expect(out.length).toBe(ALIAS_SIZE);
    }
  });

  it("hides plaintext length: different lengths encrypt to identical size", async () => {
    const key = await freshKey();
    const a = await sealToSize(key, utf8ToBytes("x"), ALIAS_SIZE);
    const b = await sealToSize(key, utf8ToBytes("x".repeat(2000)), ALIAS_SIZE);
    expect(a.length).toBe(b.length);
  });

  it("round-trips through the length frame", async () => {
    const key = await freshKey();
    const msg = utf8ToBytes(JSON.stringify({ labels: ["hiv"], route: null }));
    const out = await sealToSize(key, msg, ALIAS_SIZE);
    expect(bytesToUtf8(await openSized(key, out))).toBe(bytesToUtf8(msg));
  });

  it("a wrong key fails closed (the uniform null path)", async () => {
    const out = await sealToSize(
      await freshKey(),
      utf8ToBytes("hi"),
      ALIAS_SIZE,
    );
    // A decoy or another user's payload decrypts to a GCM failure, never a leak.
    await expect(openSized(await freshKey(), out)).rejects.toThrow();
  });

  it("decoy-shaped random bytes fail closed, indistinguishable from a miss", async () => {
    const key = await freshKey();
    const decoy = crypto.getRandomValues(new Uint8Array(ALIAS_SIZE));
    await expect(openSized(key, decoy)).rejects.toThrow();
  });

  it("refuses a plaintext that overflows the fixed block", async () => {
    const key = await freshKey();
    const tooBig = new Uint8Array(maxPlaintextForSize(ALIAS_SIZE) + 1);
    await expect(sealToSize(key, tooBig, ALIAS_SIZE)).rejects.toThrow();
  });
});

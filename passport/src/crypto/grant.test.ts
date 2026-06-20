// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  generateGrantKeyPair,
  sealToPublicKey,
  openFromPrivateKey,
} from "./grant.ts";
import { bytesToBase64url } from "./encoding.ts";

const secret = () => crypto.getRandomValues(new Uint8Array(32));

describe("grant ECIES", () => {
  it("seals to a public key and opens with the matching private key", async () => {
    const kp = await generateGrantKeyPair();
    const s = secret();
    const sealed = await sealToPublicKey(s, kp.publicKey);
    // The sealed blob carries the ephemeral public key + ciphertext, so it is
    // larger than the secret and is not the plaintext.
    expect(sealed.length).toBeGreaterThan(s.length + 65);
    expect(bytesToBase64url(sealed)).not.toContain(bytesToBase64url(s));

    const opened = await openFromPrivateKey(sealed, kp.privateKey);
    expect(opened).toEqual(s);
  });

  it("a different keypair's private key cannot open the grant", async () => {
    const recipient = await generateGrantKeyPair();
    const stranger = await generateGrantKeyPair();
    const sealed = await sealToPublicKey(secret(), recipient.publicKey);
    await expect(
      openFromPrivateKey(sealed, stranger.privateKey),
    ).rejects.toThrow();
  });

  it("a tampered grant fails to open (GCM authenticates)", async () => {
    const kp = await generateGrantKeyPair();
    const sealed = await sealToPublicKey(secret(), kp.publicKey);
    sealed[sealed.length - 1] = (sealed[sealed.length - 1] ?? 0) ^ 0x01;
    await expect(openFromPrivateKey(sealed, kp.privateKey)).rejects.toThrow();
  });

  it("two seals of the same secret differ (fresh ephemeral key each time)", async () => {
    const kp = await generateGrantKeyPair();
    const s = secret();
    const a = await sealToPublicKey(s, kp.publicKey);
    const b = await sealToPublicKey(s, kp.publicKey);
    expect(a).not.toEqual(b);
    // ...but both open to the same secret.
    expect(await openFromPrivateKey(a, kp.privateKey)).toEqual(s);
    expect(await openFromPrivateKey(b, kp.privateKey)).toEqual(s);
  });

  it("rejects a too-short sealed blob", async () => {
    const kp = await generateGrantKeyPair();
    await expect(
      openFromPrivateKey(new Uint8Array(10), kp.privateKey),
    ).rejects.toThrow();
  });
});

import { describe, it, expect } from "vitest";
import {
  bytesToBase64url,
  base64urlToBytes,
  utf8ToBytes,
  bytesToUtf8,
} from "./encoding.ts";

describe("base64url", () => {
  it("round-trips arbitrary bytes", () => {
    for (let len = 0; len < 40; len++) {
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = (i * 37 + len) & 0xff;
      expect(base64urlToBytes(bytesToBase64url(bytes))).toEqual(bytes);
    }
  });

  it("emits the url-safe alphabet with no padding", () => {
    // 0xfb 0xff forces both the + -> - and / -> _ substitutions in standard b64.
    const s = bytesToBase64url(new Uint8Array([0xfb, 0xff, 0xbf]));
    expect(s).not.toMatch(/[+/=]/);
    expect(s).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("encodes 32 random bytes to the server's fixed 43-char id length", () => {
    const id = bytesToBase64url(crypto.getRandomValues(new Uint8Array(32)));
    expect(id).toHaveLength(43);
  });

  it("accepts input with or without padding", () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const unpadded = bytesToBase64url(bytes);
    expect(base64urlToBytes(unpadded)).toEqual(bytes);
    expect(base64urlToBytes(unpadded + "=")).toEqual(bytes);
  });

  it("rejects non-base64url input loudly", () => {
    expect(() => base64urlToBytes("not valid!")).toThrow();
  });
});

describe("utf8", () => {
  it("round-trips unicode", () => {
    const s = "robin cafe (累) \u{1f33f} end";
    expect(bytesToUtf8(utf8ToBytes(s))).toBe(s);
  });
});

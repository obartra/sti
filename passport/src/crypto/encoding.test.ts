import { describe, it, expect } from "vitest";
import {
  bytesToBase64url,
  base64urlToBytes,
  bufferSourceToBytes,
  utf8ToBytes,
  bytesToUtf8,
} from "./encoding.ts";

describe("bufferSourceToBytes", () => {
  it("copies a raw ArrayBuffer", () => {
    const out = bufferSourceToBytes(new Uint8Array([1, 2, 3]).buffer);
    expect(Array.from(out)).toEqual([1, 2, 3]);
  });

  it("copies the right window of an offset view, as a detached copy", () => {
    const base = new Uint8Array([0, 1, 2, 3, 4, 5]);
    const view = new Uint8Array(base.buffer, 2, 3); // logically [2, 3, 4]
    const out = bufferSourceToBytes(view);
    expect(Array.from(out)).toEqual([2, 3, 4]);
    out[0] = 99; // mutating the copy must not touch the source
    expect(base[2]).toBe(2);
  });
});

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

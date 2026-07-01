// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  wrapPasswordEnvelope,
  unwrapPasswordEnvelope,
  serializeEnvelope,
  deserializeEnvelope,
  RECOVERY_ENVELOPE_SIZE,
  ARGON2_DEFAULT_PARAMS,
  type Argon2Params,
} from "./passwordEnvelope.ts";

// A deliberately cheap cost for the round-trip tests: the crypto path is identical
// to production, only the work factor differs, so correctness is exercised without
// spending 64 MiB and ~sub-second per call. The real launch cost is asserted
// separately against ARGON2_DEFAULT_PARAMS below.
const CHEAP: Argon2Params = {
  version: 1,
  memoryKiB: 256,
  iterations: 1,
  parallelism: 1,
};

const root = () => crypto.getRandomValues(new Uint8Array(32));

describe("password envelope", () => {
  it("round-trips the root: unwrap with the right password returns it byte-for-byte", async () => {
    const r = root();
    const env = await wrapPasswordEnvelope(r, "correct horse battery", CHEAP);
    const recovered = await unwrapPasswordEnvelope(
      env,
      "correct horse battery",
    );
    expect(recovered).toEqual(r);
  });

  it("fails closed on the wrong password (GCM rejects, no partial leak)", async () => {
    const env = await wrapPasswordEnvelope(root(), "the-real-one", CHEAP);
    await expect(
      unwrapPasswordEnvelope(env, "not-the-real-one"),
    ).rejects.toThrow();
  });

  it("stores the salt and params with the envelope so it can be reopened later", async () => {
    const env = await wrapPasswordEnvelope(root(), "pw", CHEAP);
    expect(env.salt).toHaveLength(16);
    expect(env.params).toEqual(CHEAP);
    // The wrapped root is ciphertext (iv + ct + tag), never the raw 32 bytes.
    expect(env.wrappedRoot.length).toBeGreaterThan(32);
  });

  it("mints a fresh salt each wrap, so changing the password re-wraps a distinct envelope", async () => {
    const r = root();
    const a = await wrapPasswordEnvelope(r, "pw", CHEAP);
    const b = await wrapPasswordEnvelope(r, "pw", CHEAP);
    expect(a.salt).not.toEqual(b.salt);
    expect(a.wrappedRoot).not.toEqual(b.wrappedRoot);
    // Both still open to the same root: the envelope changed, the root did not.
    expect(await unwrapPasswordEnvelope(a, "pw")).toEqual(r);
    expect(await unwrapPasswordEnvelope(b, "pw")).toEqual(r);
  });

  it("normalizes the password (NFC), so the same characters from different keyboards match", async () => {
    const r = root();
    // U+00E9 (precomposed é) vs U+0065 U+0301 (e + combining acute): same NFC form.
    const env = await wrapPasswordEnvelope(r, "café", CHEAP);
    const recovered = await unwrapPasswordEnvelope(env, "café");
    expect(recovered).toEqual(r);
  });

  it("opens an envelope only with its own stored params (a param mismatch fails closed)", async () => {
    const env = await wrapPasswordEnvelope(root(), "pw", CHEAP);
    const tampered = {
      ...env,
      params: { ...env.params, iterations: env.params.iterations + 1 },
    };
    await expect(unwrapPasswordEnvelope(tampered, "pw")).rejects.toThrow();
  });

  it("pins the documented launch cost (doc 32: 64 MiB / 3 / 1, versioned)", () => {
    expect(ARGON2_DEFAULT_PARAMS).toEqual({
      version: 1,
      memoryKiB: 64 * 1024,
      iterations: 3,
      parallelism: 1,
    });
  });
});

describe("recovery envelope wire framing", () => {
  it("serializes to exactly the fixed block size", async () => {
    const env = await wrapPasswordEnvelope(root(), "pw", CHEAP);
    expect(serializeEnvelope(env)).toHaveLength(RECOVERY_ENVELOPE_SIZE);
  });

  it("round-trips through the wire: wrap, frame, parse, unwrap yields the root", async () => {
    const r = root();
    const framed = serializeEnvelope(
      await wrapPasswordEnvelope(r, "pw", CHEAP),
    );
    const parsed = deserializeEnvelope(framed);
    expect(parsed.params).toEqual(CHEAP);
    expect(await unwrapPasswordEnvelope(parsed, "pw")).toEqual(r);
  });

  it("rejects a block of the wrong size", () => {
    expect(() => deserializeEnvelope(new Uint8Array(10))).toThrow();
  });

  it("rejects an unknown version byte (a decoy or a newer format)", async () => {
    const framed = serializeEnvelope(
      await wrapPasswordEnvelope(root(), "pw", CHEAP),
    );
    framed[0] = 0xff; // corrupt the version
    expect(() => deserializeEnvelope(framed)).toThrow();
  });

  it("fails closed on a random decoy block (never a usable envelope)", async () => {
    // What a wrong locator returns: a full-size block of high-entropy bytes. It must
    // not yield an openable envelope: either the frame is rejected, or the parsed
    // wrapped root fails to open. Try many so a chance-valid frame is still caught.
    for (let i = 0; i < 20; i++) {
      const decoy = crypto.getRandomValues(
        new Uint8Array(RECOVERY_ENVELOPE_SIZE),
      );
      let opened = false;
      try {
        await unwrapPasswordEnvelope(deserializeEnvelope(decoy), "pw");
        opened = true;
      } catch {
        // expected: either deserialize or unwrap threw
      }
      expect(opened).toBe(false);
    }
  });
});

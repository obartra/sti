// @vitest-environment node
import { describe, it, expect } from "vitest";
import type { Bytes } from "../crypto/index.ts";
import {
  classifyWebAuthnError,
  PasskeyError,
  type PasskeyAuth,
} from "./passkey.ts";

// A fake authenticator: each credential maps to a fixed random PRF secret, so
// unlock returns exactly the PRF output enroll did, the contract a real PRF
// passkey must honor. The concrete WebAuthn adapter is browser-only.
function fakePasskeyAuth(): PasskeyAuth {
  const prfByCred = new Map<string, Bytes>();
  return {
    available: () => true,
    enroll() {
      const credentialId = crypto.randomUUID();
      const prfOutput = crypto.getRandomValues(new Uint8Array(32));
      prfByCred.set(credentialId, prfOutput);
      return Promise.resolve({ credentialId, prfOutput });
    },
    unlock(credentialId) {
      const prf = prfByCred.get(credentialId);
      if (!prf) return Promise.reject(new Error("unknown credential"));
      return Promise.resolve(prf);
    },
  };
}

describe("PasskeyAuth contract", () => {
  it("unlock returns the same PRF output enroll did", async () => {
    const auth = fakePasskeyAuth();
    const { credentialId, prfOutput } = await auth.enroll("robin");
    expect(await auth.unlock(credentialId)).toEqual(prfOutput);
  });

  it("a different passkey yields a different PRF output", async () => {
    const auth = fakePasskeyAuth();
    const a = await auth.enroll("a");
    const b = await auth.enroll("b");
    expect(a.prfOutput).not.toEqual(b.prfOutput);
  });

  it("unlock throws for an unknown credential", async () => {
    const auth = fakePasskeyAuth();
    await expect(auth.unlock("nope")).rejects.toThrow();
  });
});

describe("PasskeyError + classifyWebAuthnError", () => {
  it("carries its code and is an Error", () => {
    const e = new PasskeyError("no-prf");
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("PasskeyError");
    expect(e.code).toBe("no-prf");
  });

  it("maps cancel-like DOMException names to 'cancelled'", () => {
    for (const name of ["NotAllowedError", "AbortError", "TimeoutError"]) {
      expect(classifyWebAuthnError({ name })).toBe("cancelled");
    }
  });

  it("maps everything else (and non-error values) to 'unavailable'", () => {
    const others: unknown[] = [
      { name: "SecurityError" },
      { name: "NotSupportedError" },
      new Error("boom"),
      null,
      undefined,
      "nope",
      {},
    ];
    for (const e of others) {
      expect(classifyWebAuthnError(e)).toBe("unavailable");
    }
  });
});

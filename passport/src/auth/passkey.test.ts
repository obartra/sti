// @vitest-environment node
import { describe, it, expect } from "vitest";
import { masterFromPrf, type Bytes } from "../crypto/index.ts";
import type { PasskeyAuth } from "./passkey.ts";

// A fake authenticator: each credential maps to a fixed random PRF secret, so
// unlock re-mints exactly the master enroll returned, the contract a real PRF
// passkey must honor. The concrete WebAuthn adapter is browser-only.
function fakePasskeyAuth(): PasskeyAuth {
  const prfByCred = new Map<string, Bytes>();
  return {
    available: () => true,
    async enroll() {
      const credentialId = crypto.randomUUID();
      const prf = crypto.getRandomValues(new Uint8Array(32));
      prfByCred.set(credentialId, prf);
      return { credentialId, master: await masterFromPrf(prf) };
    },
    unlock(credentialId) {
      const prf = prfByCred.get(credentialId);
      if (!prf) return Promise.reject(new Error("unknown credential"));
      return masterFromPrf(prf);
    },
  };
}

describe("PasskeyAuth contract", () => {
  it("unlock re-mints the same master enroll returned", async () => {
    const auth = fakePasskeyAuth();
    const { credentialId, master } = await auth.enroll("robin");
    expect(await auth.unlock(credentialId)).toEqual(master);
  });

  it("a different passkey yields a different master", async () => {
    const auth = fakePasskeyAuth();
    const a = await auth.enroll("a");
    const b = await auth.enroll("b");
    expect(a.master).not.toEqual(b.master);
  });

  it("unlock throws for an unknown credential", async () => {
    const auth = fakePasskeyAuth();
    await expect(auth.unlock("nope")).rejects.toThrow();
  });
});

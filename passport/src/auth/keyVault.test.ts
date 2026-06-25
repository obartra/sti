// @vitest-environment node
import { describe, it, expect } from "vitest";
import { phraseForTest } from "../test-support/phrase.ts";
import { wrapMaster, unwrapMaster } from "./keyVault.ts";
import { deriveMasterKey } from "../crypto/index.ts";

const prf = () => crypto.getRandomValues(new Uint8Array(32));

describe("key vault", () => {
  it("unwraps the master wrapped under the same PRF output", async () => {
    const master = await deriveMasterKey(phraseForTest("recovery phrase"));
    const p = prf();
    const wrapped = await wrapMaster(master, p);
    expect(await unwrapMaster(wrapped, p)).toEqual(master);
  });

  it("a different PRF output cannot unwrap (passkey loss falls back to phrase)", async () => {
    const master = await deriveMasterKey(phraseForTest("recovery phrase"));
    const wrapped = await wrapMaster(master, prf());
    await expect(unwrapMaster(wrapped, prf())).rejects.toThrow();
  });

  it("the wrapped form is not the master in the clear", async () => {
    const master = await deriveMasterKey(phraseForTest("recovery phrase"));
    const wrapped = await wrapMaster(master, prf());
    expect(wrapped).not.toEqual(master);
    expect(wrapped.length).toBeGreaterThan(master.length); // iv + tag overhead
  });
});

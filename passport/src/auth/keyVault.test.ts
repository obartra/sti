// @vitest-environment node
import { describe, it, expect } from "vitest";
import { phraseForTest } from "../test-support/phrase.ts";
import { wrapRoot, unwrapRoot } from "./keyVault.ts";
import { deriveRootKey } from "../crypto/index.ts";

const prf = () => crypto.getRandomValues(new Uint8Array(32));

describe("key vault", () => {
  it("unwraps the root wrapped under the same PRF output", async () => {
    const root = await deriveRootKey(phraseForTest("recovery phrase"));
    const p = prf();
    const wrapped = await wrapRoot(root, p);
    expect(await unwrapRoot(wrapped, p)).toEqual(root);
  });

  it("a different PRF output cannot unwrap (passkey loss falls back to phrase)", async () => {
    const root = await deriveRootKey(phraseForTest("recovery phrase"));
    const wrapped = await wrapRoot(root, prf());
    await expect(unwrapRoot(wrapped, prf())).rejects.toThrow();
  });

  it("the wrapped form is not the root in the clear", async () => {
    const root = await deriveRootKey(phraseForTest("recovery phrase"));
    const wrapped = await wrapRoot(root, prf());
    expect(wrapped).not.toEqual(root);
    expect(wrapped.length).toBeGreaterThan(root.length); // iv + tag overhead
  });
});

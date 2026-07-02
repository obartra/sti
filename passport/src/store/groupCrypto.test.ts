// @vitest-environment node
// Node exposes a complete WebCrypto (crypto.subtle); jsdom's stub does not.
import { describe, it, expect } from "vitest";
import {
  mintGroupKey,
  sealGroupCard,
  openGroupCard,
  wrapGroupKey,
  unwrapGroupKey,
  type GroupKey,
} from "./groupCrypto.ts";
import { ALIAS_PAYLOAD_SIZE } from "../api/contract.ts";
import type { Bytes } from "../crypto/index.ts";
import type { ResolvedView } from "../ui/public/PublicResolution.tsx";

const card: ResolvedView = {
  state: "blue",
  labels: ["hiv", "condoms_always"],
  route: "hiv",
  identity: { handle: "robin" },
};

// A member's 32-byte wrapping key, minted the same way the group key is.
function memberKey(): Bytes {
  return crypto.getRandomValues(new Uint8Array(32));
}

describe("mintGroupKey", () => {
  it("mints a 32-byte key, fresh each call", () => {
    const a = mintGroupKey();
    const b = mintGroupKey();
    expect(a).toHaveLength(32);
    expect(b).toHaveLength(32);
    expect(a).not.toEqual(b);
  });
});

describe("sealGroupCard / openGroupCard", () => {
  it("round-trips a card under Kg", async () => {
    const Kg = mintGroupKey();
    const opened = await openGroupCard(Kg, await sealGroupCard(Kg, card));
    expect(opened).toEqual(card);
  });

  it("seals to the fixed alias payload size (no size oracle)", async () => {
    const Kg = mintGroupKey();
    const sealed = await sealGroupCard(Kg, card);
    expect(sealed.length).toBe(ALIAS_PAYLOAD_SIZE);
  });

  it("uses a fresh IV: two seals of the same card differ, both still open", async () => {
    const Kg = mintGroupKey();
    const a = await sealGroupCard(Kg, card);
    const b = await sealGroupCard(Kg, card);
    expect(a).not.toEqual(b);
    expect(await openGroupCard(Kg, a)).toEqual(card);
    expect(await openGroupCard(Kg, b)).toEqual(card);
  });

  it("opening with the wrong Kg fails closed to null", async () => {
    const sealed = await sealGroupCard(mintGroupKey(), card);
    expect(await openGroupCard(mintGroupKey(), sealed)).toBeNull();
  });

  it("opening tampered ciphertext fails closed to null", async () => {
    const Kg = mintGroupKey();
    const sealed = await sealGroupCard(Kg, card);
    const last = sealed.length - 1;
    sealed[last] = (sealed[last] ?? 0) ^ 0x01; // flip a tag bit
    expect(await openGroupCard(Kg, sealed)).toBeNull();
  });

  it("opening decoy-shaped random bytes fails closed to null (a miss)", async () => {
    const Kg = mintGroupKey();
    const decoy = crypto.getRandomValues(new Uint8Array(ALIAS_PAYLOAD_SIZE));
    expect(await openGroupCard(Kg, decoy)).toBeNull();
  });
});

describe("wrapGroupKey / unwrapGroupKey", () => {
  it("round-trips Kg for a member", async () => {
    const Kg = mintGroupKey();
    const mk = memberKey();
    const recovered = await unwrapGroupKey(await wrapGroupKey(Kg, mk), mk);
    expect(recovered).toEqual(Kg);
  });

  it("a recovered Kg opens cards sealed under the original", async () => {
    const Kg = mintGroupKey();
    const mk = memberKey();
    const sealed = await sealGroupCard(Kg, card);
    const recovered = await unwrapGroupKey(await wrapGroupKey(Kg, mk), mk);
    expect(await openGroupCard(recovered, sealed)).toEqual(card);
  });

  it("uses a fresh IV: two wraps of the same key differ", async () => {
    const Kg = mintGroupKey();
    const mk = memberKey();
    expect(await wrapGroupKey(Kg, mk)).not.toEqual(await wrapGroupKey(Kg, mk));
  });

  it("unwrapping with the wrong member key fails closed (throws)", async () => {
    const wrapped = await wrapGroupKey(mintGroupKey(), memberKey());
    await expect(unwrapGroupKey(wrapped, memberKey())).rejects.toThrow();
  });

  it("unwrapping tampered ciphertext fails closed (throws)", async () => {
    const mk = memberKey();
    const wrapped = await wrapGroupKey(mintGroupKey(), mk);
    const last = wrapped.length - 1;
    wrapped[last] = (wrapped[last] ?? 0) ^ 0x01;
    await expect(unwrapGroupKey(wrapped, mk)).rejects.toThrow();
  });
});

describe("the group key is not shared across groups", () => {
  it("a card sealed under one group's Kg never opens under another's", async () => {
    const groupA: GroupKey = mintGroupKey();
    const groupB: GroupKey = mintGroupKey();
    const sealed = await sealGroupCard(groupA, card);
    expect(await openGroupCard(groupB, sealed)).toBeNull();
  });
});

// @vitest-environment node
import { describe, it, expect } from "vitest";
import { passkeyUnlockMessage } from "./passkeyUnlockMessage.ts";
import type { ResumeFailure } from "../../store/index.ts";

const ALL: ResumeFailure[] = [
  "no-binding",
  "no-account",
  "mismatch",
  "cancelled",
  "no-prf",
  "unavailable",
];

describe("passkeyUnlockMessage", () => {
  it("gives a distinct message per reason", () => {
    const messages = ALL.map(passkeyUnlockMessage);
    expect(new Set(messages).size).toBe(ALL.length);
  });

  it("always points to the recovery phrase as the way back in", () => {
    for (const reason of ALL) {
      expect(passkeyUnlockMessage(reason).toLowerCase()).toContain(
        "recovery phrase",
      );
    }
  });

  it("does not collapse a usable-but-incapable passkey into 'no passkey'", () => {
    // The whole point: a provider that can't do PRF (e.g. some 1Password builds)
    // must not read as "no passkey saved here".
    const noPrf = passkeyUnlockMessage("no-prf");
    expect(noPrf).not.toMatch(/no passkey is saved/i);
    expect(passkeyUnlockMessage("no-binding")).toMatch(/no passkey is saved/i);
  });
});

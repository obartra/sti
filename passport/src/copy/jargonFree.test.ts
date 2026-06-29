// @vitest-environment node
//
// Honesty enforcement (G13), extending the trust-page jargon check (trustCopy.test.ts)
// to the app's CENTRALIZED user-facing copy tables. The voice guide (doc 21) bans the
// internal vocabulary (alias, linkup, knock, findable, decoy, resolve) from anything a
// user reads, so this fails if a banned word appears in any imported copy module.
//
// SCOPE: this covers copy that is exported as a plain, importable table. Covered here:
//   - src/copy/canonical.ts            (PARTNER_NOTIFY_PROMPT, CREATE_ACCOUNT_CTA, PRIVACY_SCREEN_NAME)
//   - src/ui/connect/copy.ts           (COPY)
//   - src/ui/onboarding/claimCopy.ts   (COPY)
//   - src/ui/onboarding/recovery.copy.ts (COPY)
//   - src/ui/public/PublicResolution.copy.ts (COPY + KNOCK_UNIFORM)
//   - src/ui/findable/shareLinkGuideCopy.ts (SHARE_LINK_GUIDE + BIO_MOCKS)
// The trust pages (PRIVACY_POLICY/TERMS/TRUST_FOOTER) are already covered by
// trustCopy.test.ts, so they are not re-checked here.
// NOT covered (copy is inlined in the component, not a separate importable table, so a
// jargon scan would require rendering each screen): Home, Report, Privacy, FindableName,
// AvatarEdit, wallet, learn. Those rely on review; centralizing their copy would bring
// them under this gate.
import { describe, it, expect } from "vitest";
import {
  PARTNER_NOTIFY_PROMPT,
  CREATE_ACCOUNT_CTA,
  PRIVACY_SCREEN_NAME,
} from "./canonical.ts";
import { COPY as CONNECT_COPY } from "../ui/connect/copy.ts";
import { COPY as CLAIM_COPY } from "../ui/onboarding/claimCopy.ts";
import { COPY as RECOVERY_COPY } from "../ui/onboarding/recovery.copy.ts";
import {
  COPY as RESOLVE_COPY,
  KNOCK_UNIFORM,
} from "../ui/public/PublicResolution.copy.ts";
import {
  SHARE_LINK_GUIDE,
  BIO_MOCKS,
} from "../ui/findable/shareLinkGuideCopy.ts";

// Collect every string leaf in a copy table (nested objects and arrays included),
// tagged with a path so a failure points at the offending entry.
function strings(
  label: string,
  value: unknown,
  path = label,
): [string, string][] {
  if (typeof value === "string") return [[path, value]];
  if (Array.isArray(value)) {
    return value.flatMap((v, i) => strings(label, v, `${path}[${i}]`));
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) =>
      strings(label, v, `${path}.${k}`),
    );
  }
  return [];
}

const ALL: [string, string][] = [
  ...strings("canonical.PARTNER_NOTIFY_PROMPT", PARTNER_NOTIFY_PROMPT),
  ...strings("canonical.CREATE_ACCOUNT_CTA", CREATE_ACCOUNT_CTA),
  ...strings("canonical.PRIVACY_SCREEN_NAME", PRIVACY_SCREEN_NAME),
  ...strings("connect.COPY", CONNECT_COPY),
  ...strings("claim.COPY", CLAIM_COPY),
  ...strings("recovery.COPY", RECOVERY_COPY),
  ...strings("resolve.COPY", RESOLVE_COPY),
  ...strings("resolve.KNOCK_UNIFORM", KNOCK_UNIFORM),
  ...strings("shareLinkGuide.SHARE_LINK_GUIDE", SHARE_LINK_GUIDE),
  ...strings("shareLinkGuide.BIO_MOCKS", BIO_MOCKS),
];

describe("centralized user copy obeys the voice and honesty rules (G13)", () => {
  // The same banned-vocabulary regex trustCopy.test.ts uses (doc 21 internal words).
  const BANNED =
    /\b(alias(es)?|linkups?|knocks?|findable|decoys?|resolv\w*)\b/i;

  it("imports at least one string from each centralized module", () => {
    // Guards against a module export being renamed to {} and silently passing.
    expect(ALL.length).toBeGreaterThan(20);
  });

  it.each(ALL)("%s is free of banned vocabulary", (path, s) => {
    expect(BANNED.test(s), `"${s}" (${path}) uses banned vocabulary`).toBe(
      false,
    );
  });
});

/**
 * The promises page (doc 11 / the privacy principles): the plain-English
 * guarantees sti.care makes to a user, each unwrapped into concrete technical
 * assertions, and each assertion tied to the test that pins it (or, where a claim
 * is genuinely reasoning-only, said so out loud).
 *
 * This file is the SINGLE SOURCE the /promises page renders from AND the CI check
 * (promises.test.ts) verifies, so the page can never quietly say more than the code
 * provably delivers. Adding a promise with no test-backed assertion, or naming a
 * test that does not exist, fails the build. An overclaiming promise is a bug.
 *
 * Honesty rules baked into the data:
 * - Every promise carries its real limit in `detail`, never glossed.
 * - `kind: "reasoning"` is used ONLY where a claim cannot be a headless test
 *   (a structural property, a stated trust boundary), never to dodge writing one.
 * - Test paths are relative to passport/ (the CI check's cwd): app tests as
 *   `src/...`, Go tests as `../server/...`, mirroring the behaviour catalogue.
 */

/** A test that pins an assertion: `file` exists and contains `name` (a test title
 * substring or a Go func name), checked by promises.test.ts. */
export interface TestBacking {
  readonly kind: "test";
  readonly file: string;
  readonly name: string;
}

/** A claim that is genuinely review/reasoning-only (a structural property or a
 * stated trust boundary), with the reason it cannot be a headless test. */
export interface ReasoningBacking {
  readonly kind: "reasoning";
  readonly why: string;
}

export interface PromiseAssertion {
  /** The specific, technical thing we actually guarantee. */
  readonly claim: string;
  readonly backedBy: TestBacking | ReasoningBacking;
}

export interface UserPromise {
  readonly id: string;
  /** The simple-English guarantee, for the page. A non-technical reader gets it
   * in one pass. */
  readonly plain: string;
  /** One honest sentence of how/why, INCLUDING the real limit where there is one.
   * Never implies more than the assertions deliver. */
  readonly detail: string;
  /** The technical assertions this promise unwraps into; together they roll up to
   * exactly the plain promise, no more (no overclaim) and no less (no silent gap). */
  readonly assertions: readonly PromiseAssertion[];
}

export const PROMISES: readonly UserPromise[] = [
  {
    id: "cannot-read",
    plain: "We can't read what you save.",
    detail:
      "Everything is scrambled on your phone before it is sent. Our servers only ever hold the scrambled version, and even our own admin tools can't unlock it.",
    assertions: [
      {
        claim:
          "The card sent to our server holds only a status colour, a few labels, and routing info, never your actual results.",
        backedBy: {
          kind: "test",
          file: "src/store/publicCard.test.ts",
          name: "the wire shape is a closed whitelist",
        },
      },
      {
        claim:
          "Scrambling is authenticated encryption: a wrong key or any tampering fails to a blank, never a partial read.",
        backedBy: {
          kind: "test",
          file: "src/crypto/payload.test.ts",
          name: "rejects tampered ciphertext",
        },
      },
      {
        claim:
          "An admin sign-in unlocks none of your content: the admin secret is never a decryption key, and admin tools only ever touch opaque records.",
        backedBy: {
          kind: "reasoning",
          why: "A structural property of the design (the admin path holds no key material); doc 20 and the blind-store boundary, not a single headless assertion.",
        },
      },
    ],
  },
  {
    id: "cannot-tell-existence",
    plain: "No one can tell whether you've saved anything.",
    detail:
      "A link you never made and a link you've turned off look exactly the same to anyone who tries it. The one exception is a public findable name, which is public on purpose (see the last promise).",
    assertions: [
      {
        claim:
          "A link that was never created returns decoy data of the exact same size as a real one.",
        backedBy: {
          kind: "test",
          file: "src/api/client.integration.test.ts",
          name: "existence-uniform",
        },
      },
      {
        claim:
          "An expired or turned-off link reads as that same decoy, not a distinguishable error.",
        backedBy: {
          kind: "test",
          file: "../server/internal/server/server_test.go",
          name: "TestAliasExpiryServerEnforced",
        },
      },
      {
        claim:
          "When the app can't confirm a fresh, reachable status, it shows nothing, never a half-answer.",
        backedBy: {
          kind: "test",
          file: "src/ui/wallet/shared.test.tsx",
          name: "is blue only when blue + reachable + fresh",
        },
      },
    ],
  },
  {
    id: "revoke",
    plain: "Turn a link off, and no one can read it again.",
    detail:
      "Turning a link off overwrites it, so it can never show your status again. We can't, though, un-show what someone already saw.",
    assertions: [
      {
        claim:
          "Revoking overwrites the link's contents with random bytes, so no recoverable status is left.",
        backedBy: {
          kind: "test",
          file: "src/store/publish.test.ts",
          name: "overwrites with fixed-size, non-deterministic bytes",
        },
      },
      {
        claim:
          "After that, the link reads as the same blank decoy as a link that never existed.",
        backedBy: {
          kind: "test",
          file: "../server/internal/server/server_test.go",
          name: "TestAliasExpiryServerEnforced",
        },
      },
      {
        claim:
          "This is 'no future reads', not 'unsee': someone who already opened the link may have kept what they saw.",
        backedBy: {
          kind: "reasoning",
          why: "An honest boundary of revocation, not a guarantee we can enforce; stated so the promise never implies retraction.",
        },
      },
    ],
  },
  {
    id: "contentless-notify",
    plain: "A heads-up to get tested never says who or what.",
    detail:
      "If a recent contact suggests testing, you see a plain prompt with no name and no detail. Our server never learns who was notified or why.",
    assertions: [
      {
        claim:
          "The notify ping is a fixed marker carrying no who, when, or what.",
        backedBy: {
          kind: "test",
          file: "src/store/partnerNotify.test.ts",
          name: "round-trips a contentless partner-notify ping",
        },
      },
      {
        claim:
          "Asking the server to wake a device does identical work whether or not the device is known, so the timing reveals nothing.",
        backedBy: {
          kind: "test",
          file: "../server/internal/server/notify_test.go",
          name: "TestNotifyIntakeIsConstantTime",
        },
      },
    ],
  },
  {
    id: "unlinkable-siblings",
    plain:
      "Two people you share with can't tell they're both connected to you.",
    detail:
      "Each link you hand out has its own made-up face, its own private inbox, and updates at its own time, so two of your links can't be matched back to one person.",
    assertions: [
      {
        claim:
          "Each link's face comes from its random id out of tens of thousands of combinations, so two links rarely look alike.",
        backedBy: {
          kind: "test",
          file: "src/lib/avatars.test.ts",
          name: "shares a word pair rarely",
        },
      },
      {
        claim:
          "Each contact gets their own notify inbox, not one shared inbox two contacts could compare.",
        backedBy: {
          kind: "test",
          file: "src/store/session.integration.test.ts",
          name: "a mutual contact-link exchange links two owners both ways",
        },
      },
      {
        claim:
          "When you update your status, your links change at independently scattered times, not all in one instant.",
        backedBy: {
          kind: "test",
          file: "../server/internal/server/republish_test.go",
          name: "TestRepublishSpreadsAcrossWindow",
        },
      },
      {
        claim:
          "Our server does receive your batch of updates together, but it is the blind party and can read none of it.",
        backedBy: {
          kind: "reasoning",
          why: "A stated trust boundary (doc 18): the blind, IP-stripped origin sees the grouping but no content; not something a client test can assert away.",
        },
      },
    ],
  },
  {
    id: "no-unique-tag",
    plain:
      "Your name and face are never a unique tag, and never sit in a link.",
    detail:
      "The face and handle on a private link are invented from the link's random id, not from you, and the web address never contains your name or face.",
    assertions: [
      {
        claim:
          "The shown handle is derived from the link id (not unique to you) out of a 256 x 256 word space.",
        backedBy: {
          kind: "test",
          file: "src/lib/avatars.test.ts",
          name: "256 unique, lowercase",
        },
      },
      {
        claim:
          "Looking someone up by a findable name hands off without a key in the web address (a keyless knock).",
        backedBy: {
          kind: "test",
          file: "src/ui/app/screens/publicScreens.test.tsx",
          name: "hands a resolved name to a2-public WITHOUT a key",
        },
      },
    ],
  },
  {
    id: "only-you",
    plain: "Only you can change or delete what you've saved.",
    detail:
      "Changing or deleting your account or a link needs a secret your device keeps. Knowing the link is not enough.",
    assertions: [
      {
        claim:
          "Your account can only be overwritten or deleted with your account write key; the on-the-wire id alone is refused.",
        backedBy: {
          kind: "test",
          file: "../server/internal/server/server_test.go",
          name: "TestAccountWriteTokenGate",
        },
      },
      {
        claim:
          "Each link can only be overwritten by whoever holds its write token, never by a viewer who only has the link.",
        backedBy: {
          kind: "test",
          file: "../server/internal/store/store_test.go",
          name: "TestAliasWriteTokenRejectsNonOwner",
        },
      },
      {
        claim:
          "The admin tool's password is compared in constant time and an empty one never works.",
        backedBy: {
          kind: "test",
          file: "../server/internal/server/admin_test.go",
          name: "TestAdminEmptyTokenNeverAuthorizes",
        },
      },
    ],
  },
  {
    id: "findable-honest",
    plain:
      "Being findable is the one thing others can look up, and we tell you what that exposes.",
    detail:
      "If you claim a public name, anyone can look it up and see it exists; that's the point. Nothing else about you becomes public, and we show you this trade before you opt in.",
    assertions: [
      {
        claim:
          "A findable name resolves to a link anyone must still knock on; that the name exists is the only thing revealed.",
        backedBy: {
          kind: "test",
          file: "../server/internal/server/vanity_test.go",
          name: "TestVanityRegisterThenResolve",
        },
      },
      {
        claim:
          "Names pass a hate-speech block list while sexual, identity, and health terms are deliberately allowed.",
        backedBy: {
          kind: "test",
          file: "../server/internal/vanityname/vanityname_test.go",
          name: "TestCommittedBlocklistAllowsIdentityHealthAndSexualTerms",
        },
      },
      {
        claim:
          "This is the single intentional 'existence is public' exception to the second promise above.",
        backedBy: {
          kind: "reasoning",
          why: "A design decision (doc 17), surfaced to the user as a trade, not a property a test proves true or false.",
        },
      },
    ],
  },
];

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
 *   `src/...`, Go tests as `../server/...`, mirroring the behavior catalog.
 */

/** A test that pins an assertion: `file` exists and contains `name` (a test title
 * substring or a Go func name), checked by promises.test.ts. */
interface TestBacking {
  readonly kind: "test";
  readonly file: string;
  readonly name: string;
}

/** A claim that is genuinely review/reasoning-only (a structural property or a
 * stated trust boundary), with the reason it cannot be a headless test. */
interface ReasoningBacking {
  readonly kind: "reasoning";
  readonly why: string;
}

interface PromiseAssertion {
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
      "It's encrypted on your device before it's sent, and we only ever hold the encrypted version. We can't read it.",
    assertions: [
      {
        claim:
          "The card sent to our server holds only a status color, a few labels, and routing info, never your actual results.",
        backedBy: {
          kind: "test",
          file: "src/store/publicCard.test.ts",
          name: "the wire shape is a closed allowlist",
        },
      },
      {
        claim:
          "It's authenticated encryption: a wrong key or any tampering fails to a blank, never a partial read.",
        backedBy: {
          kind: "test",
          file: "src/crypto/payload.test.ts",
          name: "rejects tampered ciphertext",
        },
      },
      {
        claim:
          "Our admin and stats tools never read your encrypted bytes: every server lookup except the two that return your encrypted card reads only its size and timestamps, never the content.",
        backedBy: {
          kind: "test",
          file: "../server/internal/store/ciphertext_projection_test.go",
          name: "TestCiphertextProjectionAllowlist",
        },
      },
      {
        claim:
          "An admin sign-in is never a decryption key: the admin path holds no key material, so it can act on opaque records but read none of your content.",
        backedBy: {
          kind: "reasoning",
          why: "A structural property of the design (the admin path holds no key material); doc 20 and the blind-store boundary, not a single headless assertion.",
        },
      },
    ],
  },
  {
    id: "no-name",
    plain: "We never ask for your real name.",
    detail:
      "The name we ask for is optional, yours to choose, and never your real name; you can skip it entirely. There is no real-name field anywhere in what we store, and the optional one you pick is encrypted on your device, never something we can read.",
    assertions: [
      {
        claim:
          "The account we store for you has no real-name field of any kind: the saved shape carries at most an optional self-chosen handle, never a name / first / last / legal field.",
        backedBy: {
          kind: "test",
          file: "src/store/accountBlob.test.ts",
          name: "never serializes a real-name field",
        },
      },
      {
        claim:
          "The card a viewer reads carries a self-chosen handle and a status, never a real-name field.",
        backedBy: {
          kind: "test",
          file: "src/store/publicCard.test.ts",
          name: "the wire shape is a closed allowlist",
        },
      },
    ],
  },
  {
    id: "cannot-tell-existence",
    plain: "No one can tell whether you've saved anything.",
    detail:
      "A link you never made and a link you've turned off look exactly the same to anyone who tries it. The one exception is a public name you claim, which is public on purpose (see the last promise).",
    assertions: [
      {
        claim:
          "A link that was never created returns blank stand-in data the exact same size as a real one.",
        backedBy: {
          kind: "test",
          file: "src/api/client.integration.test.ts",
          name: "existence-uniform",
        },
      },
      {
        claim:
          "An expired or turned-off link reads as that same blank stand-in, not a tell-tale error.",
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
      {
        claim:
          "Connecting in person happens phone to phone, not through us: nothing is sent when you connect, so we never learn that you connected or who with.",
        backedBy: {
          kind: "test",
          file: "src/store/session.integration.test.ts",
          name: "offline mint records the contact; the reconnect republish publishes its card (doc 25)",
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
          "After that, the link reads as the same blank as a link that never existed.",
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
          "The server does the same work for a real notification and for noise, so it never learns who was notified.",
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
      "Each link you hand out has its own made-up handle and avatar, its own private inbox, and updates at its own time, so two of your links can't be matched back to one person.",
    assertions: [
      {
        claim:
          "Each link's handle comes from its random id out of tens of thousands of combinations, so two links rarely match.",
        backedBy: {
          kind: "test",
          file: "src/lib/avatars.test.ts",
          name: "shares a word pair rarely",
        },
      },
      {
        claim:
          "Each contact gets their own inbox id, write token, key, and routing token, so two contacts can't compare their links and find they both reach you.",
        backedBy: {
          kind: "test",
          file: "src/store/shareOps.test.ts",
          name: "fully distinct notify capability",
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
    ],
  },
  {
    id: "no-unique-tag",
    plain:
      "Your handle and avatar are never a unique tag, and never sit in a link.",
    detail:
      "The handle and avatar on a private link are made up from the link's random id, not from you, and the web address never contains them.",
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
          "Looking someone up by a public name never carries a key in the web address.",
        backedBy: {
          kind: "test",
          file: "src/ui/app/screens/publicScreens.test.tsx",
          name: "hands a resolved name to a2-public WITHOUT a key",
        },
      },
      {
        claim:
          "The face on a private link is drawn from the link's random id, not from any name you pick, so it is the same for that link every time and never a tag tied to you.",
        backedBy: {
          kind: "test",
          file: "src/ui/share/ShareSheet.identity.test.tsx",
          name: "deterministic per alias id",
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
          "That account write key is a separate secret, never derivable from the id that travels on the wire, so a leaked id cannot stand in for it.",
        backedBy: {
          kind: "test",
          file: "src/crypto/keys.test.ts",
          name: "account write token is deterministic, 43-char, and independent of the id and key",
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
      "A public name is the one thing others can look up, and we tell you what that exposes.",
    detail:
      "If you claim a public name, anyone can look it up and see it exists; that's the point. Nothing else about you becomes public, and we show you this trade before you opt in.",
    assertions: [
      {
        claim:
          "A public name points to a link anyone must still ask to open; that the name exists is the only thing revealed.",
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

// The user-facing copy for the trust surfaces (doc 23): the footer, the privacy
// policy, and the terms. Centralized here so it is the single source the pages
// render and the voice test checks. Every protective claim is true of the
// shipped code; the strength is that it can be read aloud and is simply true.
// Follows doc 21 (no jargon, no meta, no overclaim, no em dashes).

export const TRUST_FOOTER = {
  tagline: "Encrypted on your phone. We can't read it.",
  promises: "Our promises",
  privacy: "Privacy",
  terms: "Terms",
} as const;

/** The short link near the landing call to action. */
export const LANDING_PROMISES_LINK = "See what we promise";

/** A section of a legal page: a heading, plus prose and/or a list. */
export interface LegalBlock {
  readonly heading: string;
  readonly paragraphs?: readonly string[];
  readonly bullets?: readonly string[];
}

export interface LegalDoc {
  readonly title: string;
  readonly lead: string;
  readonly updated: string;
  readonly blocks: readonly LegalBlock[];
}

const UPDATED = "June 2026";

export const PRIVACY_POLICY: LegalDoc = {
  title: "Privacy",
  lead: "What we can see is almost nothing, and here is exactly why.",
  updated: UPDATED,
  blocks: [
    {
      heading: "What we can see",
      paragraphs: [
        "Almost nothing. Everything you record, your status, your tags, your contacts, is encrypted on your phone with a key that never leaves your device. Our server only ever holds the encrypted version and some opaque routing labels. We can't read your status, your contacts, or who you have shared with.",
        "Even an admin sign-in unlocks none of it. The admin tools only ever touch encrypted records.",
      ],
    },
    {
      heading: "What the server actually holds",
      paragraphs: [
        "All of it is either encrypted or a label that means nothing on its own:",
      ],
      bullets: [
        "Your status card, your account backup, and a separate inbox for each contact: encrypted bytes we cannot read.",
        "Routing labels and queued updates: opaque tokens we use to deliver and to scatter your link updates over time.",
        "A public name, if you choose to claim one: a name you picked, public on purpose.",
        "Access requests: opaque and short-lived.",
        "A notification subscription, only if you turn notifications on: an address at your phone's push service, not your identity.",
        "An admin action log: a record of what an operator did and to which encrypted record, never any content.",
        "Reports against public names: a fixed reason and the public name, with no free text.",
      ],
    },
    {
      heading: "What we never collect",
      paragraphs: [
        "No analytics. No trackers. No advertising. No tracking cookies. No third-party scripts. The app talks to exactly one server, ours. We do not store your email, your real name, or your location.",
      ],
    },
    {
      heading: "Your network address",
      paragraphs: [
        "Like any website, our server briefly sees your network address when your app makes a request. We use it only to slow down abuse, in memory and short-lived, and we do not write it to our database or keep request logs of it. We do not use it to build a profile.",
      ],
    },
    {
      heading: "Who else is involved",
      paragraphs: [
        "Our hosting and network providers carry the encrypted traffic for us. If you turn on notifications, your phone's push service (Apple, Google, or Mozilla, depending on your device) delivers a plain wake to open the app. That wake says nothing about who or what.",
        "We do not sell or share your data, because we have no readable data to sell.",
      ],
    },
    {
      heading: "How long we keep things",
      bullets: [
        "A shared link's card is kept until it expires, or until you turn it off, which overwrites it.",
        "Access requests expire on their own.",
        "Your account backup stays until you delete it.",
        "The admin action log is kept for accountability and holds no content.",
      ],
    },
    {
      heading: "Your choices",
      paragraphs: [
        "You hold the keys. You can turn any link off so no one can read it again, and you can delete your account from the app, which overwrites your shared links and removes your encrypted backup.",
        "One honest limit: because only your device holds your keys, if you lose them and your recovery phrase, we cannot recover your data for you, and we cannot un-show something a person already saw.",
      ],
    },
    {
      heading: "Age",
      paragraphs: ["sti.care is for adults, 18 and over."],
    },
    {
      heading: "Changes and contact",
      paragraphs: [
        "If this policy changes, we will update this page and its date. Questions about privacy: privacy@sti.care.",
      ],
    },
  ],
};

export const TERMS: LegalDoc = {
  title: "Terms",
  lead: "The plain rules for using sti.care.",
  updated: UPDATED,
  blocks: [
    {
      heading: "What sti.care is, and is not",
      paragraphs: [
        "sti.care is a private place to record and share a self-reported sexual-health status. It is not a medical test, a diagnosis, or a substitute for getting tested or talking to a clinician. A status is one person's own honest word, not a lab result, and we do not verify it.",
        "Use a status to start a conversation, not to skip testing, protection, or care.",
      ],
    },
    {
      heading: "No warranty",
      paragraphs: [
        "The service is provided as is and as available. We work hard to keep it private and available, but we can't promise it is error-free, secure against every possible threat, or always reachable, and you use it at your own discretion.",
        "To the fullest extent the law allows, we are not liable for any loss arising from your use of, or inability to use, the service. Nothing here limits liability that the law does not allow us to limit.",
      ],
    },
    {
      heading: "Using it fairly",
      paragraphs: ["Don't use sti.care to harm people. In particular:"],
      bullets: [
        "Don't claim a public name to impersonate someone, harass, or post a hateful handle. Public names are checked and can be taken down.",
        "Don't use the service to coerce, pressure, or out anyone.",
        "Don't attack or probe the service, or try to break its protections.",
      ],
    },
    {
      heading: "Your account",
      paragraphs: [
        "Your keys live on your device. You can delete everything from the app. We may take down a public name that breaks the rules above.",
      ],
    },
    {
      heading: "Eligibility",
      paragraphs: ["You must be 18 or older to use sti.care."],
    },
    {
      heading: "Changes and contact",
      paragraphs: [
        "We will post any changes to these terms on this page. Questions: privacy@sti.care.",
      ],
    },
  ],
};

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
  // A quiet way to flag a problem, on every public surface. It opens a short in-app
  // form (doc 35) whose report lands in the operator queue; the form is rate-limited
  // and asks the person to leave out anything they would not want kept.
  feedbackLead: "Something wrong?",
  feedbackLink: "Tell us",
  shareLink: "Share your link",
  // Opens the education library on its own static site (doc 34). External, so it is a
  // real anchor to info.sti.care rather than an in-app route.
  library: "STI basics",
} as const;

/** The short link near the landing call to action. */
export const LANDING_PROMISES_LINK = "See what we promise";

/** A section of a legal page: a heading, a plain-language summary, plus the full
 * binding prose and/or a list. The summary mirrors the binding text exactly and
 * sits on top of it; the binding text below is what legally applies. */
export interface LegalBlock {
  readonly heading: string;
  /** A plain, calm one-or-two-sentence read of the binding text below. It never
   * says more, less, or anything that contradicts the binding text. */
  readonly summary?: string;
  readonly paragraphs?: readonly string[];
  readonly bullets?: readonly string[];
}

export interface LegalDoc {
  readonly title: string;
  readonly lead: string;
  readonly updated: string;
  /** One line near the top: the summaries help you read; the full text binds. */
  readonly summaryNote: string;
  readonly blocks: readonly LegalBlock[];
}

const UPDATED = "June 2026";
// The privacy policy carries the early-testing note, added after the June text, so
// it shows its own later date. Terms is unchanged and keeps UPDATED.
const PRIVACY_UPDATED = "July 2026";

/** Shown once near the top of each legal page, so the layered notice is honest
 * about which part binds. Plain and calm, per doc 21. */
const SUMMARY_NOTE =
  "The short summaries are here to help you read. The full text under each one is what legally applies.";

export const PRIVACY_POLICY: LegalDoc = {
  title: "Privacy",
  lead: "What we can see is almost nothing, and here is exactly why.",
  updated: PRIVACY_UPDATED,
  summaryNote: SUMMARY_NOTE,
  blocks: [
    {
      heading: "What we can see",
      summary:
        "It's encrypted on your phone with a key that stays on your device, so we can't read your status, your contacts, or who you shared with. Even an admin sign-in unlocks none of it.",
      paragraphs: [
        "Almost nothing. Everything you record, your status, your tags, your contacts, is encrypted on your phone with a key that never leaves your device. Our server only ever holds the encrypted version and some opaque routing labels. We can't read your status, your contacts, or who you have shared with.",
        "Even an admin sign-in unlocks none of it. The admin tools only ever touch encrypted records.",
      ],
    },
    {
      heading: "What the server actually holds",
      summary:
        "Everything our server keeps is either encrypted or a label that means nothing on its own.",
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
        "A problem report, if you send one: the kind of problem and any note you write, kept so we can read it and help. It is the one thing you type that we store, so please leave out anything sensitive.",
      ],
    },
    {
      heading: "What we never collect",
      summary:
        "No analytics, trackers, ads, or third-party scripts. We don't ask for your email, real name, or location, and we don't store what you write. The one exception is a problem report you send us, so we can help.",
      paragraphs: [
        "No analytics. No trackers. No advertising. No tracking cookies. No third-party scripts. The app talks to exactly one server, ours. We don't ask for your email, your real name, or your location, and we don't store what you write. The one exception is a problem report you send us on purpose, so we can read it and help. We can't fix what we can't see, so please leave out anything sensitive.",
      ],
    },
    {
      heading: "Your network address",
      summary:
        "Our server briefly sees your network address on each request and uses it only to slow down abuse, in memory and short-lived. We don't log it, store it, or build a profile from it.",
      paragraphs: [
        "Like any website, our server briefly sees your network address when your app makes a request. We use it only to slow down abuse, in memory and short-lived, and we do not write it to our database or keep request logs of it. We do not use it to build a profile.",
      ],
    },
    {
      heading: "Who else is involved",
      summary:
        "Our hosting and network providers carry the encrypted traffic, and if you turn on notifications your phone's push service delivers a plain wake that says nothing about who or what. We don't sell or share your data, because we have none we can read.",
      paragraphs: [
        "Our hosting and network providers carry the encrypted traffic for us. If you turn on notifications, your phone's push service (Apple, Google, or Mozilla, depending on your device) delivers a plain wake to open the app. That wake says nothing about who or what.",
        "We do not sell or share your data, because we have no readable data to sell.",
      ],
    },
    {
      heading: "How long we keep things",
      summary:
        "We keep each piece only as long as it's needed, and you can end most of it yourself. If you stop using the app for about two years, we delete your backup on our own.",
      bullets: [
        "A shared link's card is kept until it expires, or until you turn it off, which overwrites it.",
        "Access requests expire on their own.",
        "Your account backup stays until you delete it, or until about two years without using the app, whichever comes first. Opening the app keeps it; we have no other way to reach you, so we cannot warn you first.",
        "A problem report you send stays until we've read it, then it's removed. We don't keep it indefinitely.",
        "The admin action log is kept for accountability and holds no content.",
      ],
    },
    {
      heading: "Your choices",
      summary:
        "You hold the keys. You can turn any link off and delete your account from the app. One honest limit: if you lose your keys and your recovery phrase we can't recover your data, and we can't un-show something a person already saw.",
      paragraphs: [
        "You hold the keys. You can turn any link off so no one can read it again, and you can delete your account from the app, which overwrites your shared links and removes your encrypted backup.",
        "One honest limit: because only your device holds your keys, if you lose them and your recovery phrase, we cannot recover your data for you, and we cannot un-show something a person already saw.",
      ],
    },
    {
      heading: "While we're in early testing",
      summary:
        "sti.care is new. What we can and can't see holds the same now as at launch, but a few protections get stronger as more people use it, and while we're small expect the occasional bug.",
      paragraphs: [
        "sti.care is new and still being tested. Everything above about what we can and cannot see holds the same now as it will at launch. Those protections are built into how the app works, not switched on later.",
        "A few of them lean on there being a crowd to blend into: the more people use sti.care, the harder it is for anyone watching the server to draw conclusions from timing or patterns. While the community is small, that cover is thinner. And like any young app, expect the occasional bug, so please don't make sti.care your only record of your health yet.",
      ],
    },
    {
      // Already one plain sentence, so no separate summary is needed.
      heading: "Age",
      paragraphs: ["sti.care is for adults, 18 and over."],
    },
    {
      heading: "Changes and contact",
      summary:
        "If this policy changes we'll update this page and its date. For privacy questions, email privacy@sti.care.",
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
  summaryNote: SUMMARY_NOTE,
  blocks: [
    {
      heading: "What sti.care is, and is not",
      summary:
        "sti.care is a private place to record and share your own sexual-health status. It isn't a medical test or a diagnosis, we don't verify a status, and it doesn't replace getting tested or talking to a clinician. Use it to start a conversation, not to skip care.",
      paragraphs: [
        "sti.care is a private place to record and share a self-reported sexual-health status. It is not a medical test, a diagnosis, or a substitute for getting tested or talking to a clinician. A status is one person's own honest word, not a lab result, and we do not verify it.",
        "Use a status to start a conversation, not to skip testing, protection, or care.",
      ],
    },
    {
      heading: "No warranty",
      summary:
        "We work hard to keep the service private and available, but we can't promise it's error-free or always reachable, and you use it at your own discretion. To the extent the law allows, we're not liable for loss from using it, and nothing here limits what the law won't let us limit.",
      paragraphs: [
        "The service is provided as is and as available. We work hard to keep it private and available, but we can't promise it is error-free, secure against every possible threat, or always reachable, and you use it at your own discretion.",
        "To the fullest extent the law allows, we are not liable for any loss arising from your use of, or inability to use, the service. Nothing here limits liability that the law does not allow us to limit.",
      ],
    },
    {
      heading: "Using it fairly",
      summary: "Don't use sti.care to harm people.",
      paragraphs: ["Don't use sti.care to harm people. In particular:"],
      bullets: [
        "Don't claim a public name to impersonate someone, harass, or post a hateful handle. Public names are checked and can be taken down.",
        "Don't use the service to coerce, pressure, or out anyone.",
        "Don't attack or probe the service, or try to break its protections.",
      ],
    },
    {
      heading: "Your account",
      summary:
        "Your keys live on your device, and you can delete everything from the app. We may take down a public name that breaks the rules above.",
      paragraphs: [
        "Your keys live on your device. You can delete everything from the app. We may take down a public name that breaks the rules above.",
      ],
    },
    {
      // Already one plain sentence, so no separate summary is needed.
      heading: "Eligibility",
      paragraphs: ["You must be 18 or older to use sti.care."],
    },
    {
      heading: "Changes and contact",
      summary:
        "We'll post any changes to these terms on this page. For questions, email privacy@sti.care.",
      paragraphs: [
        "We will post any changes to these terms on this page. Questions: privacy@sti.care.",
      ],
    },
  ],
};

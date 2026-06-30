// User-facing copy for the share-your-link guide (docs 16 and 17). Centralized
// here so it is the single source the in-app and public versions render and the
// voice test checks. Follows doc 21: plain, calm, no jargon ("public name", not
// "vanity"/"findable"), sentence case, "and" not "&", no exclamation points, no
// em dashes. Every claim about what a public link exposes is true of the shipped
// modes: the name is findable, but the status stays private until you grant it.

// The host a public name resolves at. Display only (no scheme); the QR encodes
// the full https form built from it.
export const PUBLIC_HOST = "sti.care";

/** Build the display link for a public name, e.g. "sti.care/u/robin". */
export function publicLinkFor(handle: string): string {
  return `${PUBLIC_HOST}/u/${handle}`;
}

/** Build the full https link a QR encodes for a public name. */
export function publicHttpsLinkFor(handle: string): string {
  return `https://${publicLinkFor(handle)}`;
}

// The sample name the public version of the guide shows. Never a real account,
// never a status, just an example so the page renders for anyone (doc 17).
export const SAMPLE_HANDLE = "sam";

export const SHARE_LINK_GUIDE = {
  title: "Share your link",
  // One calm line for the post-claim moment. Outcome first (doc 21 rule 3), and it
  // sets the ask-first expectation that the link itself carries: people find you by
  // name and ask, they do not see your status just by opening it.
  lead: "Your public name is live. Share this link where people meet you, and they can find you and ask to see your status.",
  linkLabel: "Your public link",
  // The editable handle field on the standalone page: type your own public name to
  // see the link, QR, and bio examples adapt.
  handleLabel: "Your public name",
  handleHint:
    "Letters, numbers, and underscores. This is what people look you up by.",
  handlePlaceholder: SAMPLE_HANDLE,
  copy: "Copy link",
  copied: "Copied",
  saveQr: "Save QR image",
  qrNote: "For in person, let someone scan this.",
  // The honest line about what a public bio link exposes (doc 16/17 disclosure):
  // people can see you are here and ask; they still cannot see your status until
  // you grant it. One positive, not a pile of negatives (doc 21 rule 4).
  exposes:
    "A link in your bio lets people see you are on sti.care and ask to view your status. They still cannot see your status until you grant it.",
  // The opt-in exception is not the only path. Anyone who would rather not have a
  // public name can send a private link instead (Direct/Gated, doc 16). Do not
  // push everyone to public.
  altTitle: "Would rather stay private?",
  alt: "You do not need a public name. Send a private link to one person instead, and only they can open it.",
  // The bio-placement section.
  placeTitle: "Where it goes",
  placeLead:
    "Anywhere people decide whether to message you. Your dating profiles, your bio, your link in bio.",
} as const;

/** A stylized bio mockup: the kind of place, and the line that frames the link. */
export interface BioMock {
  /** The mock kind, used to pick its layout. */
  readonly kind: "profile" | "oneline" | "linkrow";
  /** A short, on-brand surface name (no real app trademark). */
  readonly surface: string;
  /** A generic field/section label, e.g. "About". */
  readonly field: string;
  /** The bio line around the link; "{link}" marks where the link is highlighted. */
  readonly line: string;
}

// Three stylized placements (doc brief): a profile "About" field, a one-line bio,
// and a link-in-bio row. Well-known apps are named only in passing as examples,
// never pixel-copied.
export const BIO_MOCKS: readonly BioMock[] = [
  {
    kind: "profile",
    surface: "Your dating profile",
    field: "About",
    line: "420-friendly, love a long hike. My status, fresh and yours to check: {link}",
  },
  {
    kind: "oneline",
    surface: "Your bio",
    field: "Bio",
    line: "Here for the good ones. Check me first: {link}",
  },
  {
    kind: "linkrow",
    surface: "Your link in bio",
    field: "Links",
    line: "{link}",
  },
] as const;

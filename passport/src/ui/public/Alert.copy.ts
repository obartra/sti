import { PARTNER_NOTIFY_PROMPT } from "../../copy/canonical.ts";

export const C = {
  eyebrow: "A private heads-up",
  title: `${PARTNER_NOTIFY_PROMPT}.`,
  sub: "It’s quick, and often free. A good moment to look after your health.",
  findTesting: "Find free testing near me",
  findCondoms: "Find free condoms near me",
  findPrep: "Find free or low-cost PrEP near me",
  findPepNear: "Find PEP near me",
  findPepNearSub: "After a possible HIV exposure",
  resourcesTitle: "Free help nearby",
  whyTesting: "In person is best, especially soon after a possible exposure.",
  inAppNote:
    "This reached you anonymously. Whoever sent it can’t see that you’ve opened it.",
  reassureTitle: "What this means",
  reassure: [
    "Getting checked is quick and simple.",
    "Testing is free at many clinics and takes only minutes.",
    "This alert is anonymous. No one can see your name.",
  ],
} as const;

export const PEP = {
  title: "PEP can still prevent HIV",
  body: "If you’ve had a possible exposure, PEP can still prevent HIV. Start within 72 hours; the sooner the better.",
  cta: "Find PEP near me",
  window: "72-hour window",
  softTitle: "On PrEP? PEP is your backup if doses slipped",
  softBody:
    "PrEP protects you when you take it consistently. Missed doses recently? PEP can still prevent HIV after an exposure if you start within 72 hours. If your PrEP’s been on track, you’re already covered.",
  suppressNote:
    "PEP prevents new HIV infection, so it isn’t relevant here. Staying in care and on treatment is what protects you and your partners.",
} as const;

export const PARTNERS = {
  previewBanner: "Previewing what they’ll receive",
  backToReview: "Back to review",
} as const;

// B2 recovery phrase copy, verbatim from copy.js (recovery). Passkey stays the
// primary unlock; this phrase is the only no-PII way back in if the device is
// lost. No email/phone, no server reset.
export const COPY = {
  step: "Step 2 of 3",
  title: "Save your recovery phrase",
  sub: "This is the only way back into your account if you lose this device.",
  whyTitle: "Why you need this",
  whyBody:
    "Your account lives on this device, with no email or phone attached. If you lose the device, this phrase is the only way back in. We can’t recover it for you.",
  phraseLabel: "Your recovery phrase",
  revealHint: "Tap to reveal your 12 words",
  copy: "Copy phrase",
  copied: "Copied",
  saveTip:
    "Write it down, or save it in a password manager. Keep it somewhere safe and private.",
  savedCta: "I’ve saved it",
  confirmTitle: "Quick check",
  confirmSub: "Tap word number {n} from your phrase, so we know it’s saved.",
  confirmWrong: "That’s not it. Check your saved phrase and try again.",
  confirmRight: "That’s the one.",
  reshow: "Show my phrase again",
  cta: "Continue",
  noResetNote:
    "There’s no email reset and no support backdoor. Only this phrase can restore your account.",
  words: [
    "harbor",
    "violet",
    "cedar",
    "lantern",
    "meadow",
    "cobalt",
    "ginger",
    "pebble",
    "orchard",
    "thistle",
    "walnut",
    "saffron",
  ],
} as const;

export const ASK = 6; // verify word #7 (0-based 6)

// B2 recovery phrase copy, verbatim from copy.js (recovery) where it still
// applies. The phrase is an app-generated, high-entropy token (not a word list);
// it is shown once, behind a tap-to-reveal, with copy. Passkey stays the primary
// unlock; this token is the only no-PII way back in if the device is lost. No
// email/phone, no server reset.
export const COPY = {
  step: "Step 2 of 3",
  title: "Save your recovery phrase",
  sub: "This is the only way back into your account if you lose this device.",
  whyTitle: "Why you need this",
  whyBody:
    "Your account lives on this device, with no email or phone attached. If you lose the device, this phrase is the only way back in. We can’t recover it for you.",
  phraseLabel: "Your recovery phrase",
  revealHint: "Reveal your phrase",
  copy: "Copy phrase",
  copied: "Copied",
  saveTip:
    "Write it down, or save it in a password manager. Keep it somewhere safe and private.",
  savedCta: "I’ve saved it",
  noResetNote:
    "There’s no email reset and no support backdoor. Only this phrase can restore your account.",
} as const;

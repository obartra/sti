// B2 recovery phrase copy. The phrase is an app-generated, high-entropy token
// (not a word list); it is shown once, behind a tap-to-reveal, with copy. Passkey
// stays the primary unlock; this token is the only no-PII way back in if the
// device is lost. No email/phone, no server reset.
export const COPY = {
  step: "Step 2 of 3",
  title: "Save your recovery phrase",
  sub: "It's the only way back in if you lose this device.",
  phraseLabel: "Your recovery phrase",
  revealHint: "Reveal your phrase",
  copy: "Copy phrase",
  copied: "Copied",
  savedCta: "I've saved it",
} as const;

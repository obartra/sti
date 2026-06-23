import type { CSSProperties } from "react";

// B1 claim account copy. Passkey is the one MVP unlock path: no email, no phone,
// no SSO. The handle + avatar are your MAIN IDENTITY (doc 15): the face you can
// choose to show. Every link is anonymous by default; how a link is reached
// (Direct / Gated / Findable) is chosen later at first-run setup (doc 16).
export const COPY = {
  title: "Create your account",
  sub: "One key unlocks everything you make. No name, no email required.",
  step: "Step 1 of 3",
  loginTitle: "Welcome back",
  loginSub: "Unlock with your passkey.",
  loginStep: "Log in",
  passkey: "Passkey",
  usePasskeyLogin: "Unlock with passkey",
  keyLabel: "Your account key",
  passkeyHint:
    "Face or fingerprint is your account key, the anchor that unlocks every alias you make. Never shown, never in a link.",
  recoverLabel: "On a new device?",
  recoverHint:
    "Enter the recovery phrase you saved at signup. It’s the only way back in without this device’s passkey.",
  recoverPlaceholder: "Your recovery phrase",
  recoverCta: "Recover account",
  identitySection: "Your identity",
  identityHandleLabel: "Your name",
  identityHandlePlaceholder: "Pick a display name",
  identityHandleTooShort: "At least 3 characters.",
  identityHandleHint:
    "A display name you can choose to show on a link. Not your address, and not unique across the app.",
  avatarLabel: "Your face",
  avatarHint:
    "No photos on sti.care. Pick a hair, skin and hair colors, a mood, and a beard. This is your avatar, the look you can choose to show.",
  defaultSection: "What a link shows by default",
  anonNote:
    "A link shows an anonymous face and an opaque address by default, both derived from the link itself, not the avatar above. The avatar you built only appears on a link when you choose to reveal yourself. Two links can’t be tied together.",
  promiseTitle: "Our privacy promise",
  promise: [
    "We never show what you tested for, only a status.",
    "You can revoke any alias or delete everything, anytime.",
    "Partner alerts are anonymous by design.",
  ],
  cta: "Continue",
} as const;

export const sectionLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--text-subtle)",
};

import type { CSSProperties } from "react";

// B1 claim account copy, verbatim from copy.js (claim). Passkey is the one MVP
// unlock path: no email, no phone, no SSO. The first alias is opaque + PRIVATE
// by default; vanity is an explicit, public-only opt-in (off by default).
export const COPY = {
  title: "Create your account",
  sub: "One key unlocks everything you make. No name, no email required.",
  step: "Step 1 of 3",
  loginTitle: "Welcome back",
  loginSub: "Unlock with your passkey.",
  loginStep: "Log in",
  passkey: "Passkey",
  usePasskey: "Create passkey",
  usePasskeyLogin: "Unlock with passkey",
  keyLabel: "Your account key",
  passkeyHint:
    "Face or fingerprint is your account key, the anchor that unlocks every alias you make. Never shown, never in a link.",
  recoverLabel: "On a new device?",
  recoverHint:
    "Enter the recovery phrase you saved at signup. It’s the only way back in without this device’s passkey.",
  recoverPlaceholder: "Your recovery phrase",
  recoverCta: "Recover account",
  aliasSection: "Your first alias",
  opaqueNote:
    "Your address is an opaque id, not your handle, so two aliases can’t be linked by their URL.",
  newLook: "New look",
  aliasHandleLabel: "Handle on this alias",
  aliasHandleHint:
    "Just a display name, not your address, and not unique across the app.",
  avatarLabel: "Build your avatar",
  avatarHint:
    "No photos on sti.care. Pick an animal and dress it up; each alias gets its own look.",
  visTitle: "Who can open it?",
  visPrivate: "Private",
  visPublic: "Public link",
  visPrivateNote:
    "Private by default. Only people you hand a link to can see it. To anyone else, there’s no sign it exists at all.",
  visPublicNote:
    "A public alias puts its key in the link itself, anyone you send it to can see the badge.",
  vanityTitle: "Make it findable with a custom handle",
  vanityOff: "Off by default",
  vanityWarn:
    "Findable, not unlinkable. It points at your status and anyone can look it up, use it only where you’d be fine being recognized.",
  promiseTitle: "Our privacy promise",
  promise: [
    "We never show what you tested for, only a status.",
    "You can revoke any alias or delete everything, anytime.",
    "Partner alerts are anonymous by design.",
  ],
  cta: "Continue",
} as const;

export type Vis = "private" | "public";

export const sectionLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--text-subtle)",
};

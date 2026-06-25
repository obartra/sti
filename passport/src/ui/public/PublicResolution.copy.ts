import type { CSSProperties } from "react";
import { CREATE_ACCOUNT_CTA } from "../../copy/canonical.ts";

export const COPY = {
  soft: CREATE_ACCOUNT_CTA,
  verify: "How sti.care works",
  selfBanner: "This is what others see.",
  knockTitle: "Have a link to them?",
  knockBody:
    "You can ask this person to share their status with you. They decide, and they’ll only know you asked if they choose to look.",
  knockCta: "Request access",
  knockFootnote: "Asking shares nothing about you and stays private.",
  knockSentBody:
    "If they choose to share, their status appears next time you open this link.",
  knockDone: "Done",
  explainerTap: "What does this mean?",
  explainerTitle: "What this card means",
  explainer: [
    [
      "A blue card",
      "It means this person says they’ve tested recently and takes steps to prevent HIV. Any tags show what they share, not how. It’s their own honest word, not a lab result.",
    ],
    [
      "What it doesn’t mean",
      "Blue means one thing: a recent test and steps to prevent HIV. It isn’t a reason to skip a conversation, testing, or protection.",
    ],
    [
      "A gray card",
      "Gray just means there’s no status to show right now. That’s normal, not a warning, and not an STI. People are gray for all kinds of reasons.",
    ],
    [
      "What to do",
      "Use this to start a conversation, not skip one. Ask, share what you know, and get tested together when you can.",
    ],
  ],
  explainerClose: "Got it",
} as const;

// Sourced from the knock action's reply so the requester confirmation is
// byte-identical to the action on every path.
export const KNOCK_UNIFORM =
  "If this person registered, your request was sent.";

export const backBtn: CSSProperties = {
  appearance: "none",
  border: "none",
  background: "var(--surface-card)",
  boxShadow: "var(--shadow-sm)",
  width: 36,
  height: 36,
  borderRadius: "50%",
  flex: "none",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  color: "var(--text-body)",
};

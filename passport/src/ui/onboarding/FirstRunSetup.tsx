import type { ReactNode } from "react";
import { ConsentLine } from "./ConsentLine.tsx";
import { KeepSignedInToggle } from "./KeepSignedInToggle.tsx";
import { Button } from "../../design/components/index.ts";
import { Hand, Calendar, Users, ArrowRight } from "../../design/icons.tsx";
import { TopBack } from "./TopBack.tsx";
import "./onboarding.css";

// B3 first-run setup. A short explainer of how the passport works before the owner
// enters: they add their own results, the status stays fresh for a window, and a
// linked partner's positive reaches them as an anonymous heads-up. Sharing is not
// chosen here (doc 16): a new account is private by default, and how each link is
// shared is decided per link from "Share my passport", never as an account setting.
const COPY = {
  title: "How your passport works",
  sub: "A quick look before you start.",
  selfTitle: "You add your own results",
  selfBody:
    "No clinic logins, no waiting. What you share is your own word, as you report it.",
  freshTitle: "Freshness window",
  freshBody: "Your status stays current for 90 days, then asks for a re-test.",
  anonTitle: "A heads-up that looks out for you",
  anonBody:
    "If someone you've linked with reports a positive, you get a private heads-up. Always anonymous, never names a condition.",
  cta: "Enter my passport",
} as const;

// One explainer point: a hairline opens it, the icon stays naked accent.
function Point({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="onb__point">
      <span aria-hidden className="onb__point-icon">
        {icon}
      </span>
      <div>
        <div className="onb__point-title">{title}</div>
        <div className="onb__point-body">{body}</div>
      </div>
    </div>
  );
}

export interface FirstRunSetupProps {
  onBack?: () => void;
  /** Enter the app. A new account is private by default; there is no reach choice. */
  onEnter?: () => void;
  /** Finishing setup is in flight (account write + passkey enroll). */
  busy?: boolean;
  /** A user-facing error if finishing setup failed. */
  error?: string | null;
  /** "Keep me signed in on this device" choice + setter (doc 24). */
  keepSignedIn?: boolean;
  onKeepSignedInChange?: (v: boolean) => void;
  /** Open the privacy policy / terms from the consent line (doc 23). */
  onViewPrivacyPolicy?: () => void;
  onViewTerms?: () => void;
}

export function FirstRunSetup({
  onBack,
  onEnter,
  busy = false,
  error = null,
  keepSignedIn = true,
  onKeepSignedInChange,
  onViewPrivacyPolicy,
  onViewTerms,
}: FirstRunSetupProps) {
  return (
    <div className="onb">
      <TopBack title="Step 3 of 3" onBack={onBack} />
      <div>
        <h1 className="onb__title">{COPY.title}</h1>
        <p className="onb__sub">{COPY.sub}</p>
      </div>

      <Point
        icon={<Hand size={20} />}
        title={COPY.selfTitle}
        body={COPY.selfBody}
      />
      <Point
        icon={<Calendar size={20} />}
        title={COPY.freshTitle}
        body={COPY.freshBody}
      />
      <Point
        icon={<Users size={20} />}
        title={COPY.anonTitle}
        body={COPY.anonBody}
      />

      <KeepSignedInToggle
        checked={keepSignedIn}
        onChange={onKeepSignedInChange}
      />

      {error !== null && (
        <div role="alert" className="onb__error">
          {error}
        </div>
      )}
      <Button
        variant="primary"
        size="lg"
        block
        disabled={busy}
        onClick={() => onEnter?.()}
      >
        {COPY.cta} <ArrowRight size={18} />
      </Button>
      <ConsentLine
        onViewPrivacyPolicy={onViewPrivacyPolicy}
        onViewTerms={onViewTerms}
      />
    </div>
  );
}

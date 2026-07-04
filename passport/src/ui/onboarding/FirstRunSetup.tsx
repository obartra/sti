import { useState } from "react";
import type { ReactNode } from "react";
import { ConsentLine } from "./ConsentLine.tsx";
import { KeepSignedInToggle } from "./KeepSignedInToggle.tsx";
import { Button } from "../../design/components/index.ts";
import {
  Hand,
  Calendar,
  Globe,
  Lock,
  Users,
  ArrowRight,
} from "../../design/icons.tsx";
import { TopBack } from "./TopBack.tsx";
import { cx } from "../../lib/cx.ts";
import "./onboarding.css";

// B3 first-run setup. Sets the freshness intro and the account's default reach
// mode (doc 16): how the links you share let people reach your status. Direct
// (hand someone a keyed link, instant) is the default; Gated (post a link, you
// approve each knock) is the privacy-forward alternative; Findable (a memorable
// name) is the third mode, not built yet, shown as a pointer so the roadmap is
// honest.
const COPY = {
  title: "How your passport works",
  sub: "Two quick defaults. Change either later in settings.",
  selfTitle: "You add your own results",
  selfBody:
    "No clinic logins, no waiting. What you share is your own word, as you report it.",
  freshTitle: "Freshness window",
  freshBody: "Your status stays current for 90 days, then asks for a re-test.",
  reachTitle: "How people reach your status",
  reachDirect: "Direct link",
  reachDirectSub:
    "You hand someone a link and it opens to your status right away.",
  reachGated: "Ask first",
  reachGatedSub:
    "Post a link anywhere. You approve each person before they see anything.",
  reachFindable: "Findable",
  reachFindableReadySub:
    "A memorable name people can find. Claim one anytime from settings.",
  reachNote: "Either way, only people you send a link to can find you.",
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

// One reach mode as a quiet radio row: just the mode name, selection reading
// through ink and border weight. The description for the selected mode is shown
// once below, so picking a mode visibly changes the copy instead of sitting inert.
function ReachChoice({
  title,
  checked,
  onPick,
}: {
  title: string;
  checked: boolean;
  onPick: () => void;
}) {
  return (
    <label className={cx("onb__choice", checked && "onb__choice--on")}>
      <input
        type="radio"
        name="reach-mode"
        aria-label={title}
        checked={checked}
        onChange={onPick}
      />
      <span className="onb__choice-title">{title}</span>
    </label>
  );
}

// The Findable mode (vanity name + request, doc 16/17). Informational, not a
// selectable sharing mode: a name is claimed separately from Settings, so this
// row just points there.
function FindableRow() {
  return (
    <div className="onb__aside">
      <span aria-hidden className="onb__aside-icon">
        <Globe size={14} />
      </span>
      <div>
        <div className="onb__aside-title">{COPY.reachFindable}</div>
        <div className="onb__aside-body">{COPY.reachFindableReadySub}</div>
      </div>
    </div>
  );
}

// How-people-reach-your-status section: Direct (default) vs Gated as radio rows,
// plus the informational Findable row. Maps to the account sharing mode: Direct =
// "public" (the key rides the link, instant), Gated = "link" (no key, each viewer
// knocks).
function ReachSection({
  sharing,
  onChange,
}: {
  sharing: "public" | "link";
  onChange: (next: "public" | "link") => void;
}) {
  return (
    <div className="onb__reach">
      <fieldset className="onb__choices">
        <legend className="onb__legend">{COPY.reachTitle}</legend>
        <ReachChoice
          title={COPY.reachGated}
          checked={sharing === "link"}
          onPick={() => onChange("link")}
        />
        <ReachChoice
          title={COPY.reachDirect}
          checked={sharing === "public"}
          onPick={() => onChange("public")}
        />
      </fieldset>
      <p className="onb__choice-sub">
        {sharing === "public" ? COPY.reachDirectSub : COPY.reachGatedSub}
      </p>
      <FindableRow />
      <div className="onb__note">
        <span aria-hidden className="onb__note-icon">
          <Lock size={12} />
        </span>
        {COPY.reachNote}
      </div>
    </div>
  );
}

export interface FirstRunSetupProps {
  onBack?: () => void;
  /** Enter the app with the chosen account-level sharing default. */
  onEnter?: (sharingMode: "public" | "link") => void;
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
  // "Ask first" (Gated, "link") is the default: private by default, you approve each
  // viewer. "Direct" ("public") is the opt-in where a link you hand over opens
  // instantly. Either is changeable per link and in settings.
  const [sharing, setSharing] = useState<"public" | "link">("link");
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
      <ReachSection sharing={sharing} onChange={setSharing} />
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
        onClick={() => onEnter?.(sharing)}
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

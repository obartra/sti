import type { ReactNode } from "react";
import { Button } from "../../design/components/index.ts";
import { BadgeCard } from "../badge-card.tsx";
import {
  Bell,
  Lock,
  Link as LinkIcon,
  ArrowRight,
} from "../../design/icons.tsx";
import { LANDING } from "./desktop-landing.copy.ts";
import "./desktop-landing.css";

/* Section components for the A1 desktop marketing landing. Split out of
   DesktopLanding.tsx so each file stays under the length ceiling. Styled by
   desktop-landing.css on the editorial grammar (doc 37). */

export interface LandingHandlers {
  onClaim?: (() => void) | undefined;
  onSample?: (() => void) | undefined;
  onLogin?: (() => void) | undefined;
  onHome?: (() => void) | undefined;
  /** Count of access requests this device has made; shows the way-back link when
   * above zero. */
  pendingCount?: number | undefined;
  /** Open the list of requests this viewer has made. */
  onRequests?: (() => void) | undefined;
}

// ── Value column ────────────────────────────────────────────────────────────
function ValueColumn({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="dland__value">
      <span aria-hidden className="dland__value-icon">
        {icon}
      </span>
      <div className="dland__value-title">{title}</div>
      <div className="dland__value-body">{body}</div>
    </div>
  );
}

// ── Top nav ─────────────────────────────────────────────────────────────────
export function LandingHeader({
  onClaim,
  onLogin,
  onHome,
  pendingCount,
  onRequests,
}: LandingHandlers) {
  return (
    <header className="dland__header">
      <div className="dland__frame dland__header-row">
        <button
          type="button"
          onClick={onHome}
          aria-label="sti.care home"
          className="dland__brand"
        >
          <img src="/assets/logo/logo-wordmark.svg" alt="sti.care" />
        </button>
        <div className="dland__header-actions">
          {pendingCount && onRequests ? (
            <Button variant="ghost" size="md" onClick={onRequests}>
              Links you asked to see
            </Button>
          ) : null}
          <Button variant="ghost" size="md" onClick={onLogin}>
            Log in
          </Button>
          <Button variant="primary" size="md" onClick={onClaim}>
            {LANDING.claim} <ArrowRight size={17} />
          </Button>
        </div>
      </div>
    </header>
  );
}

// ── Hero copy column ─────────────────────────────────────────────────────────
function HeroCopy({ onClaim, onSample }: LandingHandlers) {
  return (
    <div>
      <div className="e-eyebrow dland__eyebrow">{LANDING.eyebrow}</div>
      <h1 className="dland__title">{LANDING.title}</h1>
      <p className="dland__sub">{LANDING.sub}</p>
      <div className="dland__cta-row">
        <Button variant="primary" size="lg" onClick={onClaim}>
          {LANDING.claim} <ArrowRight size={18} />
        </Button>
        <Button variant="secondary" size="lg" onClick={onSample}>
          {LANDING.sample}
        </Button>
      </div>
      <div className="dland__privacy">
        <Lock size={15} /> Privacy-first · never names a condition · never a
        verdict
      </div>
    </div>
  );
}

// ── Hero sample-card column ──────────────────────────────────────────────────
function HeroSample() {
  return (
    <div className="dland__sample">
      <div className="dland__sample-frame">
        <BadgeCard
          state="blue"
          labels={["hiv", "condoms_always"]}
          identity={{ handle: "sam" }}
          width="100%"
        />
        <span className="dland__sample-tag">Sample</span>
      </div>
    </div>
  );
}

// ── Hero section ─────────────────────────────────────────────────────────────
export function Hero({ onClaim, onSample }: LandingHandlers) {
  return (
    <section>
      <div className="dland__frame dland__hero">
        <HeroCopy onClaim={onClaim} onSample={onSample} />
        <HeroSample />
      </div>
    </section>
  );
}

// ── Value band ───────────────────────────────────────────────────────────────
const VALUE_ICONS: ((p: { size?: number }) => ReactNode)[] = [
  LinkIcon,
  Lock,
  Bell,
];

export function ValueBand() {
  return (
    <section className="dland__band">
      <div className="dland__frame dland__band-grid">
        {LANDING.points.map((p, i) => {
          const Ico = VALUE_ICONS[i] ?? LinkIcon;
          return (
            <ValueColumn
              key={p[0]}
              icon={<Ico size={22} />}
              title={p[0]}
              body={p[1]}
            />
          );
        })}
      </div>
    </section>
  );
}

// ── Closing invitation ───────────────────────────────────────────────────────
export function ClosingCTA({ onClaim }: LandingHandlers) {
  return (
    <section className="dland__frame dland__closing">
      <div className="e-card dland__closing-card">
        <div className="dland__closing-copy">
          <h2 className="dland__closing-title">Your status, your call.</h2>
          <p className="dland__closing-sub">
            Claim a passport in about a minute. No name, no email, just a single
            status you choose to share.
          </p>
        </div>
        <Button variant="primary" size="lg" onClick={onClaim}>
          {LANDING.claim} <ArrowRight size={18} />
        </Button>
      </div>
    </section>
  );
}

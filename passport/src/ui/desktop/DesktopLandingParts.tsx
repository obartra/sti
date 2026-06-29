import type { CSSProperties, ReactNode } from "react";
import { Button, Card } from "../../design/components/index.ts";
import { BadgeCard } from "../badge-card.tsx";
import {
  Bell,
  Lock,
  Link as LinkIcon,
  ArrowRight,
} from "../../design/icons.tsx";
import { LANDING } from "./desktop-landing.copy.ts";

/* Section components for the A1 desktop marketing landing. Split out of
   DesktopLanding.tsx so each file stays under the length ceiling. Faithful port
   of the design's app/desktop.jsx Landing; output is unchanged. */

const SECTION_MAX: CSSProperties = { maxWidth: 1120, margin: "0 auto" };

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

// ── Value band card ─────────────────────────────────────────────────────────
function ValueCard({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <span
        style={{
          width: 48,
          height: 48,
          borderRadius: "var(--radius-md)",
          flex: "none",
          background: "var(--accent-soft)",
          color: "var(--text-accent)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </span>
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: "var(--text-strong)",
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </div>
      <div
        style={{ fontSize: 15, lineHeight: 1.6, color: "var(--text-muted)" }}
      >
        {body}
      </div>
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
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 5,
        background: "color-mix(in srgb, var(--surface-app), transparent 8%)",
        backdropFilter: "saturate(1.2) blur(8px)",
        WebkitBackdropFilter: "saturate(1.2) blur(8px)",
        borderBottom: "1px solid var(--divider)",
      }}
    >
      <div
        style={{
          ...SECTION_MAX,
          padding: "16px 40px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <button
          type="button"
          onClick={onHome}
          aria-label="sti.care home"
          style={{
            appearance: "none",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            padding: 0,
            display: "inline-flex",
          }}
        >
          <img
            src="/assets/logo/logo-wordmark.svg"
            alt="sti.care"
            style={{ height: 32 }}
          />
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
      <div
        style={{
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--text-accent)",
          marginBottom: 18,
        }}
      >
        {LANDING.eyebrow}
      </div>
      <h1
        style={{
          fontSize: "clamp(44px, 4.6vw, 64px)",
          fontWeight: 800,
          letterSpacing: "-0.03em",
          lineHeight: 1.04,
          color: "var(--text-strong)",
          margin: 0,
          textWrap: "balance",
        }}
      >
        {LANDING.title}
      </h1>
      <p
        style={{
          fontSize: 19,
          lineHeight: 1.6,
          color: "var(--text-body)",
          margin: "22px 0 0",
          maxWidth: 480,
        }}
      >
        {LANDING.sub}
      </p>
      <div
        style={{ display: "flex", gap: 12, marginTop: 32, flexWrap: "wrap" }}
      >
        <Button variant="primary" size="lg" onClick={onClaim}>
          {LANDING.claim} <ArrowRight size={18} />
        </Button>
        <Button variant="secondary" size="lg" onClick={onSample}>
          {LANDING.sample}
        </Button>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: 26,
          color: "var(--text-subtle)",
          fontSize: 13.5,
        }}
      >
        <Lock size={15} /> Privacy-first · never names a condition · never a
        verdict
      </div>
    </div>
  );
}

// ── Hero sample-card column ──────────────────────────────────────────────────
function HeroSample() {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: "-6% -4%",
          background:
            "radial-gradient(closest-side, color-mix(in srgb, var(--accent), transparent 80%), transparent)",
          borderRadius: "50%",
          pointerEvents: "none",
        }}
      />
      <div style={{ position: "relative", width: 380, maxWidth: "100%" }}>
        <BadgeCard
          state="blue"
          labels={["hiv", "condoms_always"]}
          identity={{ handle: "sam" }}
          width="100%"
        />
        <span
          style={{
            position: "absolute",
            top: -10,
            left: 18,
            background: "var(--ink-900)",
            color: "#fff",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            padding: "4px 10px",
            borderRadius: "var(--radius-pill)",
          }}
        >
          Sample
        </span>
      </div>
    </div>
  );
}

// ── Hero section ─────────────────────────────────────────────────────────────
export function Hero({ onClaim, onSample }: LandingHandlers) {
  return (
    <section style={{ position: "relative", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          top: -160,
          right: -80,
          width: 620,
          height: 620,
          background:
            "radial-gradient(closest-side, color-mix(in srgb, var(--accent), transparent 82%), transparent)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -220,
          left: -120,
          width: 520,
          height: 520,
          background:
            "radial-gradient(closest-side, color-mix(in srgb, var(--accent), transparent 88%), transparent)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          ...SECTION_MAX,
          position: "relative",
          padding: "84px 40px 72px",
          display: "grid",
          gridTemplateColumns: "1.05fr 0.95fr",
          gap: 72,
          alignItems: "center",
        }}
      >
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
    <section
      style={{
        background: "var(--surface-card)",
        borderTop: "1px solid var(--divider)",
        borderBottom: "1px solid var(--divider)",
      }}
    >
      <div
        style={{
          ...SECTION_MAX,
          padding: "64px 40px",
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 44,
        }}
      >
        {LANDING.points.map((p, i) => {
          const Ico = VALUE_ICONS[i] ?? LinkIcon;
          return (
            <ValueCard
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

// ── Closing CTA ──────────────────────────────────────────────────────────────
export function ClosingCTA({ onClaim }: LandingHandlers) {
  return (
    <section style={{ ...SECTION_MAX, padding: "72px 40px" }}>
      <Card
        variant="tint"
        pad="lg"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 32,
          flexWrap: "wrap",
        }}
      >
        <div style={{ maxWidth: 560 }}>
          <h2
            style={{
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: "var(--text-strong)",
              margin: 0,
            }}
          >
            Your status, your call.
          </h2>
          <p
            style={{
              fontSize: 16,
              lineHeight: 1.6,
              color: "var(--text-body)",
              margin: "10px 0 0",
            }}
          >
            Claim a passport in about a minute. No name, no email, just a single
            status you choose to share.
          </p>
        </div>
        <Button variant="primary" size="lg" onClick={onClaim}>
          {LANDING.claim} <ArrowRight size={18} />
        </Button>
      </Card>
    </section>
  );
}

// ── Footer ───────────────────────────────────────────────────────────────────

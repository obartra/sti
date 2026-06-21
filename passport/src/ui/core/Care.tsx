import type { CSSProperties, ReactNode } from "react";
import { Button, Card, Row } from "../../design/components/index.ts";
import {
  MapPin,
  Stethoscope,
  Shield,
  Heart,
  Chevron,
  Info,
  Phone,
  Clock,
} from "../../design/icons.tsx";

// Care: testing, at-home screening, local resource finders, and learn-and-talk
// rows. Faithful port of core-app.jsx Care, copy verbatim from copy.js (care +
// the learn.official / learn.title / learn.sub / learn.footer strings the
// screen reads). The `badge` is TWO-STATE only (blue / gray): a gray viewer
// (no status yet) additionally sees the at-home screening prompt. There is no
// four-light status here.
const COPY = {
  care: {
    title: "Care",
    getTestedEyebrow: "Get tested",
    getTested: "Free and low-cost testing near you. Many take walk-ins.",
    findClinic: "Find a clinic",
    heymistrEyebrow: "At-home screening",
    heymistr:
      "New to testing? Heymistr ships discreet at-home screening kits on a regular schedule.",
    heymistrCta: "Sign up",
    resourcesEyebrow: "Free & low-cost near you",
    // PEP is post-exposure and time-critical (under 72h), so it leads the resource
    // finders. Copy matches the public /exposed page for one voice across surfaces.
    pepTitle: "PEP, if it has been under 72 hours",
    pepSub: "Emergency HIV prevention, time-sensitive",
    condomsTitle: "Find free condoms near you",
    condomsSub:
      "Health centers and community programs that hand them out at no cost.",
    prepTitle: "Find free or low-cost PrEP near you",
    prepSub:
      "Daily HIV-prevention pill. Many clinics offer it free or on a sliding scale.",
    finderCta: "Find nearby",
    learn: "Learn & talk",
    rows: [
      ["How your passport works", "What’s shared, what stays private"],
      ["Talk to someone", "CDC-INFO · free & confidential · 24/7"],
    ],
    talkNumber: "18002324636",
    callLabel: "Call CDC-INFO",
  },
  learn: {
    title: "STI basics",
    sub: "Learn and share what to do. No judgment. One page each.",
    official: "Or see the official CDC testing list",
    footer:
      "This is general info, not medical advice. A clinic or doctor can tell you what is right for you. Based on U.S. CDC guidance.",
  },
} as const;

const sectionLbl: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--text-subtle)",
  margin: "4px 0 10px",
};

const leadTile: CSSProperties = {
  flex: "none",
  width: 40,
  height: 40,
  borderRadius: "var(--radius-sm)",
  background: "var(--accent-soft)",
  color: "var(--text-accent)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

// Two-state badge: "blue" (has a status) or "gray" (no status yet). The at-home
// screening prompt only shows for "gray". This is the approved two-state model,
// never a four-light status.
export type CareBadge = "blue" | "gray";

export interface CareProps {
  badge?: CareBadge;
  onFindClinic?: (() => void) | undefined;
  onLearnOfficial?: (() => void) | undefined;
  onHeymistr?: (() => void) | undefined;
  onFindCondoms?: (() => void) | undefined;
  onFindPep?: (() => void) | undefined;
  onFindPrep?: (() => void) | undefined;
  onLearn?: (() => void) | undefined;
}

function GetTestedCard({
  onFindClinic,
  onLearnOfficial,
}: {
  onFindClinic?: (() => void) | undefined;
  onLearnOfficial?: (() => void) | undefined;
}) {
  const c = COPY.care;
  return (
    <Card
      style={{
        borderRadius: "var(--radius-lg)",
        padding: 20,
        background: "var(--accent)",
        boxShadow: "var(--shadow-md), var(--shadow-accent)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          color: "#fff",
          marginBottom: 8,
        }}
      >
        <MapPin size={20} />
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            opacity: 0.9,
          }}
        >
          {c.getTestedEyebrow}
        </span>
      </div>
      <div
        style={{
          fontSize: 19,
          fontWeight: 700,
          color: "#fff",
          lineHeight: 1.3,
          marginBottom: 14,
        }}
      >
        {c.getTested}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <Button
          variant="secondary"
          onClick={onFindClinic}
          style={{ background: "#fff", borderColor: "transparent" }}
        >
          {c.findClinic}
        </Button>
        <button
          type="button"
          onClick={onLearnOfficial}
          style={{
            appearance: "none",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            font: "inherit",
            fontSize: 13,
            fontWeight: 600,
            color: "#fff",
            textDecoration: "underline",
            textUnderlineOffset: 3,
            opacity: 0.9,
          }}
        >
          {COPY.learn.official}
        </button>
      </div>
    </Card>
  );
}

function HeymistrCard({
  onHeymistr,
}: {
  onHeymistr?: (() => void) | undefined;
}) {
  const c = COPY.care;
  return (
    <Card
      variant="flat"
      style={{ display: "flex", alignItems: "center", gap: 14 }}
    >
      <span style={leadTile}>
        <Stethoscope size={20} />
      </span>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--text-subtle)",
          }}
        >
          {c.heymistrEyebrow}
        </div>
        <div
          style={{
            fontSize: 14.5,
            color: "var(--text-body)",
            lineHeight: 1.4,
            marginTop: 2,
          }}
        >
          {c.heymistr}
        </div>
      </div>
      <Button variant="ghost" size="sm" onClick={onHeymistr}>
        {c.heymistrCta}
      </Button>
    </Card>
  );
}

function LearnRows({ onLearn }: { onLearn?: (() => void) | undefined }) {
  const c = COPY.care;
  const chevron = <Chevron size={18} />;
  const learnIcons: ReactNode[] = [
    <Shield key="shield" size={20} />,
    <Info key="info" size={20} />,
  ];
  return (
    <Card
      variant="flat"
      style={{ padding: 6, display: "flex", flexDirection: "column" }}
    >
      <Row
        lead={<Heart size={20} />}
        title={COPY.learn.title}
        sub={COPY.learn.sub}
        trail={chevron}
        onClick={onLearn}
      />
      {c.rows.map((row, i) => {
        const isTalk = row[0] === "Talk to someone";
        const lead = isTalk ? <Phone size={20} /> : learnIcons[i];
        const trail: ReactNode = isTalk ? (
          <a
            href={"tel:" + c.talkNumber}
            aria-label={c.callLabel}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              flex: "none",
              textDecoration: "none",
              background: "var(--accent-soft)",
              color: "var(--text-accent)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Phone size={18} />
          </a>
        ) : (
          chevron
        );
        const onClick = isTalk
          ? () => {
              window.location.href = "tel:" + c.talkNumber;
            }
          : undefined;
        return (
          <Row
            key={row[0]}
            lead={lead}
            title={row[0]}
            sub={row[1]}
            trail={trail}
            onClick={onClick}
          />
        );
      })}
    </Card>
  );
}

export function Care({
  badge = "gray",
  onFindClinic,
  onLearnOfficial,
  onHeymistr,
  onFindCondoms,
  onFindPep,
  onFindPrep,
  onLearn,
}: CareProps) {
  const c = COPY.care;
  const chevron = <Chevron size={18} />;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        width: "100%",
        maxWidth: 390,
      }}
    >
      <h1
        style={{
          fontSize: 26,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          color: "var(--text-strong)",
        }}
      >
        {c.title}
      </h1>

      <GetTestedCard
        onFindClinic={onFindClinic}
        onLearnOfficial={onLearnOfficial}
      />

      {badge === "gray" && <HeymistrCard onHeymistr={onHeymistr} />}

      <div style={sectionLbl}>{c.resourcesEyebrow}</div>
      <Card
        variant="flat"
        style={{ padding: 6, display: "flex", flexDirection: "column" }}
      >
        <Row
          lead={<Clock size={20} />}
          title={c.pepTitle}
          sub={c.pepSub}
          trail={chevron}
          onClick={onFindPep}
        />
        <Row
          lead={<Shield size={20} />}
          title={c.condomsTitle}
          sub={c.condomsSub}
          trail={chevron}
          onClick={onFindCondoms}
        />
        <Row
          lead={<Stethoscope size={20} />}
          title={c.prepTitle}
          sub={c.prepSub}
          trail={chevron}
          onClick={onFindPrep}
        />
      </Card>

      <div style={sectionLbl}>{c.learn}</div>
      <LearnRows onLearn={onLearn} />

      <div
        style={{
          fontSize: 11.5,
          color: "var(--text-subtle)",
          lineHeight: 1.5,
          textAlign: "center",
          padding: "0 8px",
        }}
      >
        {COPY.learn.footer}
      </div>
    </div>
  );
}

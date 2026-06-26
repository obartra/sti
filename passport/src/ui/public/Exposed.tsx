import { Button, Card, Row } from "../../design/components/index.ts";
import {
  Stethoscope,
  Clock,
  Shield,
  Chevron,
  Lock,
} from "../../design/icons.tsx";
import { RESOURCES, openResource } from "../../lib/resources.ts";
import { CREATE_ACCOUNT_CTA } from "../../copy/canonical.ts";

// The public page the off-app heads-up text links to (sti.care/exposed). Fully
// anonymous: no account, no sign-in, no identity, no token. It just turns "a
// recent contact suggested testing" into the next steps, calmly. Reuses the same
// CDC/PrEP locators as Care.
export interface ExposedProps {
  /** Soft CTA: start your own passport (onboarding). */
  onClaim?: (() => void) | undefined;
}

const sectionLbl = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase" as const,
  color: "var(--text-subtle)",
};

export function Exposed({ onClaim }: ExposedProps) {
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
      <div>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "var(--text-strong)",
          }}
        >
          A heads-up worth acting on
        </h1>
        <p
          style={{
            fontSize: 15,
            lineHeight: 1.55,
            color: "var(--text-body)",
            marginTop: 8,
          }}
        >
          Someone you&apos;ve been in contact with recently suggested getting an
          STI test. It&apos;s a responsible heads-up, not a diagnosis, and who
          sent it stays private.
        </p>
      </div>

      <Card variant="tint" style={{ fontSize: 13.5, lineHeight: 1.55 }}>
        STIs are common and often have no symptoms, so testing is the only way
        to know. Most are quick to treat or easy to manage, and testing is
        usually fast and often free.
      </Card>

      <div style={sectionLbl}>What to do</div>
      <Card
        variant="flat"
        style={{ padding: 6, display: "flex", flexDirection: "column" }}
      >
        <Row
          lead={<Stethoscope size={20} />}
          title="Find free testing near you"
          sub="CDC test finder"
          trail={chevron}
          onClick={() => openResource(RESOURCES.clinic)}
        />
        <Row
          lead={<Clock size={20} />}
          title="PEP, if it has been under 72 hours"
          sub="Emergency HIV prevention, time-sensitive"
          trail={chevron}
          onClick={() => openResource(RESOURCES.pep)}
        />
        <Row
          lead={<Shield size={20} />}
          title="PrEP for prevention going forward"
          sub="Find a PrEP provider"
          trail={chevron}
          onClick={() => openResource(RESOURCES.prep)}
        />
      </Card>

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 7,
          padding: "0 4px",
          color: "var(--text-subtle)",
          fontSize: 12,
          lineHeight: 1.5,
        }}
      >
        <Lock size={13} style={{ flex: "none", marginTop: 2 }} /> This page is
        anonymous. No account, no sign-in, nothing tied to you.
      </div>

      <Button variant="ghost" size="md" block onClick={onClaim}>
        {CREATE_ACCOUNT_CTA}
      </Button>
    </div>
  );
}

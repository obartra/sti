import { useState } from "react";
import { Button, Card } from "../../design/components/index.ts";
import {
  Eye,
  EyeOff,
  Care as CareIcon,
  ShieldCheck,
} from "../../design/icons.tsx";
import { CheckRow } from "./Report.route.tsx";
import { COPY as REPORT_COPY } from "./Report.parts.tsx";
import type { ReportPreview } from "../../core/report.ts";

/* "Where you stand": the owner-only standing breakdown on Home. This is the
   owner's own screen, not a viewer surface, so it can show the per-requirement
   detail the badge collapses: where you are toward blue, when the next test is
   due, and a way straight to testing. It still sits behind a blur by default
   (the same cover the recovery token uses): the screen can be over a shoulder
   or in a screenshot, so the behavioral detail stays hidden until you tap. */

// What the footer line says given the current standing, so the breakdown ends on
// a plain "you're fine" / "here's why not" sentence rather than just check rows.
function footerLine(
  standing: ReportPreview,
  daysLeft: number,
  tested: boolean,
): string {
  if (standing.willBeBlue) {
    const days = daysLeft === 1 ? "1 day" : `${daysLeft} days`;
    return `You're up to date. Next test in ${days}.`;
  }
  if (tested && daysLeft === 0)
    return "Your last test is too old now. A fresh test brings your status back.";
  return "Still gray until each of these is met.";
}

function Header({
  revealed,
  onHide,
}: {
  revealed: boolean;
  onHide: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ color: "var(--text-accent)", flex: "none" }}>
        <ShieldCheck size={18} />
      </span>
      <div
        style={{
          flex: 1,
          fontSize: 14,
          fontWeight: 800,
          color: "var(--text-strong)",
        }}
      >
        Where you stand
      </div>
      {revealed && (
        <button
          type="button"
          onClick={onHide}
          style={{
            appearance: "none",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            color: "var(--text-accent)",
            fontSize: 13,
            fontWeight: 700,
            padding: "4px 2px",
          }}
        >
          <EyeOff size={14} /> Hide
        </button>
      )}
    </div>
  );
}

function Body({
  standing,
  footer,
  revealed,
  onReveal,
}: {
  standing: ReportPreview;
  footer: string;
  revealed: boolean;
  onReveal: () => void;
}) {
  return (
    <div style={{ position: "relative" }}>
      <div
        aria-hidden={!revealed}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
          filter: revealed ? "none" : "blur(6px)",
          userSelect: revealed ? "auto" : "none",
          transition: "filter var(--dur-base) var(--ease-gentle)",
        }}
      >
        <CheckRow
          met={standing.recentPanel}
          title={REPORT_COPY.blueRecent}
          sub={REPORT_COPY.blueRecentSub}
        />
        <CheckRow
          met={standing.clear}
          title={REPORT_COPY.blueClear}
          sub={REPORT_COPY.blueClearSub}
        />
        <CheckRow
          met={standing.route}
          title={REPORT_COPY.blueRoute}
          sub={REPORT_COPY.blueRouteSub}
        />
        <div
          style={{
            fontSize: 12.5,
            fontWeight: 700,
            color: standing.willBeBlue
              ? "var(--status-clear-base)"
              : "var(--text-subtle)",
            borderTop: "1px solid var(--divider)",
            paddingTop: 11,
          }}
        >
          {footer}
        </div>
      </div>
      {!revealed && (
        <button
          type="button"
          onClick={onReveal}
          aria-label="Show where you stand"
          style={{
            position: "absolute",
            inset: 0,
            appearance: "none",
            border: "none",
            cursor: "pointer",
            background: "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            color: "var(--text-accent)",
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          <Eye size={20} /> Show details
        </button>
      )}
    </div>
  );
}

export function StandingCard({
  standing,
  daysLeft,
  tested,
  onFindTesting,
}: {
  standing: ReportPreview;
  daysLeft: number;
  tested: boolean;
  onFindTesting: (() => void) | undefined;
}) {
  const [revealed, setRevealed] = useState(false);
  return (
    <Card
      variant="flat"
      style={{ display: "flex", flexDirection: "column", gap: 14 }}
    >
      <Header revealed={revealed} onHide={() => setRevealed(false)} />
      <Body
        standing={standing}
        footer={footerLine(standing, daysLeft, tested)}
        revealed={revealed}
        onReveal={() => setRevealed(true)}
      />
      <Button
        variant="secondary"
        size="sm"
        icon={<CareIcon size={15} />}
        onClick={onFindTesting}
      >
        Find testing
      </Button>
    </Card>
  );
}

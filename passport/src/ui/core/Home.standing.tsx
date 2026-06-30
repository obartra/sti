import { Button, Card } from "../../design/components/index.ts";
import { Care as CareIcon } from "../../design/icons.tsx";
import { CheckRow } from "./Report.route.tsx";
import { COPY as REPORT_COPY } from "./Report.parts.tsx";
import type { ReportPreview } from "../../core/report.ts";

/* "Your criteria": the owner-only standing breakdown on Home. This is the
   owner's own screen, not a viewer surface, so it can show the per-requirement
   detail the badge collapses: where you are toward blue, when the next test is
   due, and a way straight to testing. On Home it is one side of a labeled toggle
   ("what others see" / "your criteria"), so it is unambiguous that this view is
   private to the owner and is not what gets shared. */

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

export function CriteriaView({
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
  return (
    <Card
      variant="flat"
      style={{ display: "flex", flexDirection: "column", gap: 14 }}
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
        {footerLine(standing, daysLeft, tested)}
      </div>
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

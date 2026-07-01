import type { ReactNode } from "react";
import { Button } from "../../design/components/index.ts";
import { Plus, Share, Care as CareIcon, Heart } from "../../design/icons.tsx";
import type { Standing } from "./Home.status.ts";

interface QuickAction {
  key: string;
  label: string;
  icon: ReactNode;
  run: (() => void) | undefined;
  primary: boolean;
}

interface ActionArgs {
  standing: Standing;
  onShare: (() => void) | undefined;
  onReport: (() => void) | undefined;
  onFindCare: (() => void) | undefined;
}

// The primary action tracks standing: an untested or lapsed owner adds a result;
// a paused/recovering owner continues care; a blue owner shares. The rest are a
// compact, always-useful set. Care only appears as "continue" while paused.
function primaryAction(a: ActionArgs): QuickAction {
  if (a.standing === "paused")
    return {
      key: "care",
      label: "Continue my care",
      icon: <CareIcon size={18} />,
      run: a.onFindCare,
      primary: true,
    };
  if (a.standing === "blue")
    return {
      key: "share",
      label: "Share my passport",
      icon: <Share size={18} />,
      run: a.onShare,
      primary: true,
    };
  return {
    key: "report",
    label: "Add a result",
    icon: <Plus size={18} />,
    run: a.onReport,
    primary: true,
  };
}

function secondaryActions(a: ActionArgs): QuickAction[] {
  const share: QuickAction = {
    key: "share",
    label: "Share my passport",
    icon: <Share size={18} />,
    run: a.onShare,
    primary: false,
  };
  const report: QuickAction = {
    key: "report",
    label: "Add a result",
    icon: <Plus size={18} />,
    run: a.onReport,
    primary: false,
  };
  const care: QuickAction = {
    key: "care",
    label: "Find care",
    icon: <Heart size={18} />,
    run: a.onFindCare,
    primary: false,
  };
  if (a.standing === "paused") return [report, care];
  if (a.standing === "blue") return [report, care];
  return [share, care];
}

function QuickButton({ action }: { action: QuickAction }) {
  return (
    <Button
      variant={action.primary ? "primary" : "secondary"}
      size={action.primary ? "lg" : "md"}
      block
      icon={action.icon}
      onClick={action.run}
    >
      {action.label}
    </Button>
  );
}

// The context-aware action set: one primary that tracks standing, then a compact
// row of the always-useful rest. Reuses the existing Home handlers only.
export function HomeActions(args: ActionArgs) {
  const primary = primaryAction(args);
  const secondary = secondaryActions(args);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <QuickButton action={primary} />
      <div style={{ display: "flex", gap: 10 }}>
        {secondary.map((action) => (
          <QuickButton key={action.key} action={action} />
        ))}
      </div>
    </div>
  );
}

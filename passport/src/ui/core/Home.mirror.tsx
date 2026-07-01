import { Button, Card } from "../../design/components/index.ts";
import { Eye, Link as LinkIcon } from "../../design/icons.tsx";
import { blueHeadline } from "../badge-card.tsx";
import type { ProtectionLabel, Route } from "../badge-card.tsx";
import type { HomeBadge } from "./Home.parts.tsx";

// The honest mirror in one plain line: what a viewer resolves on your links. Not
// the full card, not a paragraph. A blue owner sees their route stated; a gray
// owner sees the single neutral line every gray collapses to.
function mirrorLine(
  viewerBadge: HomeBadge,
  labels: ProtectionLabel[],
  route: Route,
): string {
  return viewerBadge === "blue"
    ? blueHeadline(labels, route)
    : "No status shared right now";
}

export function ViewerMirror({
  viewerBadge,
  labels,
  route,
  onViewAs,
  onManageLinks,
}: {
  viewerBadge: HomeBadge;
  labels: ProtectionLabel[];
  route: Route;
  onViewAs: (() => void) | undefined;
  onManageLinks: (() => void) | undefined;
}) {
  return (
    <Card
      variant="flat"
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      <div>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          On your links, people see
        </div>
        <div
          style={{ fontSize: 15, fontWeight: 700, color: "var(--text-strong)" }}
        >
          {mirrorLine(viewerBadge, labels, route)}
        </div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <Button
          variant="ghost"
          size="sm"
          icon={<Eye size={15} />}
          onClick={onViewAs}
        >
          See what others see
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={<LinkIcon size={15} />}
          onClick={onManageLinks}
        >
          Manage links
        </Button>
      </div>
    </Card>
  );
}

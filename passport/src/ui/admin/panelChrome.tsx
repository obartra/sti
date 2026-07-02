import { Badge } from "../../design/components/index.ts";

// Mirrors the server's adminReportsLimit: the review and feedback list endpoints each
// return at most this many rows, so a badge that reaches this value means "at least
// this many" and renders with a trailing + rather than silently under-reporting a
// backlog larger than one page.
const QUEUE_CAP = 200;

// Shared heading for the operator panels (doc 20). A semantic <h2> with the panel's
// title and one-line subtitle, plus an optional count badge on the right so a queue's
// backlog shows on the panel itself rather than as a duplicate stat card elsewhere.
// The count is shown only when defined and positive, so an empty or still-loading
// queue carries no badge; a count at the page cap renders as "200+".
export function PanelHeading({
  title,
  sub,
  count,
}: {
  title: string;
  sub: string;
  count?: number | undefined;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
      <div style={{ flex: 1 }}>
        <h2
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 800,
            color: "var(--text-strong)",
          }}
        >
          {title}
        </h2>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{sub}</div>
      </div>
      {count !== undefined && count > 0 && (
        <Badge variant="count">
          {count >= QUEUE_CAP ? `${QUEUE_CAP}+` : count}
        </Badge>
      )}
    </div>
  );
}

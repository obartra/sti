import { useCallback, useEffect, useState } from "react";
import { Button, Card } from "../../design/components/index.ts";
import type { AdminHealth, AdminHealthResult } from "./adminApi.ts";

// The health panel (doc 20): a read-only, at-a-glance view of the box's operational
// health, so a backing-up send queue, a stalled background loop, or a rise in internal
// errors is visible on the page instead of only by reading /metrics on the server.
// Every figure is a count, an age, or a system size, never a per-account or per-id
// value (doc 12), so it stays within the blind-store boundary. It sits at the top of
// the console as the first thing an operator reads: a single status chip summarizes it,
// the tiles below break it down.

// The transport the panel needs, injected so tests and Storybook drive it without a
// server (and so AdminPage can bind it to its apiBase + token).
export interface HealthOps {
  get: (token: string) => Promise<AdminHealthResult>;
}

const COPY = {
  title: "Service health",
  sub: "How the box is running right now. Aggregate signals only, never facts about people.",
  loading: "Loading health…",
  loadError: "Couldn't load health. Check your connection and try again.",
  retry: "Retry",
  refresh: "Refresh",
  statusOk: "All clear",
  statusWarn: "Needs a look",
  statusUnknown: "Health unknown",
  errorsLabel: "Internal errors",
  queueLabel: "Send queue",
  loopLabel: "Background loop",
  inflightLabel: "In flight",
  neverRan: "no tick yet",
  queueClear: "empty",
  noErrors: "none since start",
} as const;

// How long the oldest queued send may sit, or the background loop may go between
// ticks, before the status turns from "all clear" to "needs a look". Generous, so a
// brief blip does not cry wolf; a genuinely stuck drain or a stalled loop grows well
// past these. The loop threshold clears a slow janitor interval (STI_JANITOR_INTERVAL
// defaults to 1 min but is operator-configurable) with wide margin, so a healthy box
// on a longer tick never flickers amber; the metrics-scrape alert catches a real
// stall in real time regardless, this chip is the at-a-glance echo.
const QUEUE_STUCK_SECONDS = 300;
const LOOP_STALE_SECONDS = 900;

type HealthTone = "ok" | "warn" | "unknown";

export interface HealthStatus {
  tone: HealthTone;
  label: string;
}

// Sum every subsystem's internal-error count. Cumulative since boot, so any nonzero
// total is worth a look on this low-traffic box (the same >0 tripwire the alert email
// uses).
function totalErrors(h: AdminHealth): number {
  return h.errors.reduce((sum, e) => sum + e.count, 0);
}

// Reduce the snapshot to one status: "needs a look" if any internal error is logged,
// the send queue is stuck draining, or the background loop has gone stale; otherwise
// "all clear". A never-run loop (age -1) is a fresh boot, not a stall.
export function healthStatus(h: AdminHealth | null): HealthStatus {
  if (h === null) return { tone: "unknown", label: COPY.statusUnknown };
  const stuckQueue = h.sendQueueOldestAgeSeconds > QUEUE_STUCK_SECONDS;
  const staleLoop = h.janitorAgeSeconds > LOOP_STALE_SECONDS;
  if (totalErrors(h) > 0 || stuckQueue || staleLoop) {
    return { tone: "warn", label: COPY.statusWarn };
  }
  return { tone: "ok", label: COPY.statusOk };
}

// Status tone to the design's status tokens: clear (green) for all-clear, treat
// (amber) for needs-a-look, none (grey) for an unknown/failed read.
const TONE_TOKEN: Record<HealthTone, string> = {
  ok: "clear",
  warn: "treat",
  unknown: "none",
};

// A short "3s" / "5m" / "2h" / "1d" from a second count, so an age reads at a glance.
function humanAge(seconds: number): string {
  if (seconds <= 0) return "just now";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

// Friendly labels for the fixed subsystem error-types the server reports; an unknown
// type falls back to its raw name so a new server type still renders.
const ERROR_LABEL: Record<string, string> = {
  store: "Storage",
  enqueue: "Send queue",
  janitor: "Background loop",
  decode: "Decode",
};

function StatusChip({ status }: { status: HealthStatus }) {
  const token = TONE_TOKEN[status.tone];
  return (
    <span
      style={{
        alignSelf: "flex-start",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12.5,
        fontWeight: 700,
        padding: "4px 10px",
        borderRadius: 999,
        color: `var(--status-${token}-fg)`,
        background: `var(--status-${token}-bg)`,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: `var(--status-${token}-fg)`,
        }}
      />
      {status.label}
    </span>
  );
}

function HealthTile({
  label,
  value,
  note,
  warn,
}: {
  label: string;
  value: string;
  note?: string;
  warn?: boolean;
}) {
  return (
    <Card
      variant="flat"
      style={{ display: "flex", flexDirection: "column", gap: 4 }}
    >
      <div
        style={{
          fontSize: 20,
          fontWeight: 800,
          color: warn ? "var(--status-treat-fg)" : "var(--text-strong)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 11.5,
          fontWeight: 600,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: "var(--text-subtle)",
        }}
      >
        {label}
      </div>
      {note !== undefined && (
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{note}</div>
      )}
    </Card>
  );
}

// The per-subsystem error breakdown, shown only when something has been logged (an
// all-zero box shows a plain "none since start" instead of four zeros).
function ErrorBreakdown({ health }: { health: AdminHealth }) {
  const nonzero = health.errors.filter((e) => e.count > 0);
  if (nonzero.length === 0) {
    return (
      <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
        {COPY.errorsLabel}: {COPY.noErrors}.
      </div>
    );
  }
  return (
    <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
      {COPY.errorsLabel}:{" "}
      {nonzero
        .map((e) => `${ERROR_LABEL[e.type] ?? e.type} ${e.count}`)
        .join(" · ")}
    </div>
  );
}

function HealthGrid({ health }: { health: AdminHealth }) {
  const errs = totalErrors(health);
  const queueNote =
    health.sendQueueDepth > 0
      ? `oldest ${humanAge(health.sendQueueOldestAgeSeconds)}`
      : COPY.queueClear;
  const loopValue =
    health.janitorAgeSeconds < 0
      ? COPY.neverRan
      : humanAge(health.janitorAgeSeconds);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
        gap: 10,
      }}
    >
      <HealthTile
        label={COPY.errorsLabel}
        value={errs.toLocaleString("en-US")}
        warn={errs > 0}
      />
      <HealthTile
        label={COPY.queueLabel}
        value={health.sendQueueDepth.toLocaleString("en-US")}
        note={queueNote}
        warn={health.sendQueueOldestAgeSeconds > QUEUE_STUCK_SECONDS}
      />
      <HealthTile
        label={COPY.loopLabel}
        value={loopValue}
        warn={health.janitorAgeSeconds > LOOP_STALE_SECONDS}
      />
      <HealthTile
        label={COPY.inflightLabel}
        value={`${health.inflightCurrent} / ${health.inflightMax}`}
      />
    </div>
  );
}

export function HealthPanel({
  token,
  ops,
  onUnauthorized,
  refreshSignal = 0,
}: {
  token: string;
  ops: HealthOps;
  onUnauthorized: () => void;
  // Bumped by the shell's "Refresh" control to re-read without a remount.
  refreshSignal?: number;
}) {
  const [status, setStatus] = useState<"loading" | "ready" | "loadError">(
    "loading",
  );
  const [health, setHealth] = useState<AdminHealth | null>(null);

  const load = useCallback(() => {
    setStatus("loading");
    void ops
      .get(token)
      .then((r) => {
        if (r.kind === "ok") {
          setHealth(r.health);
          setStatus("ready");
        } else if (r.kind === "unauthorized") {
          onUnauthorized();
        } else {
          setStatus("loadError");
        }
      })
      .catch(() => setStatus("loadError"));
  }, [ops, token, onUnauthorized]);

  useEffect(() => {
    load();
  }, [load, refreshSignal]);

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <h2
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 800,
              color: "var(--text-strong)",
            }}
          >
            {COPY.title}
          </h2>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
            {COPY.sub}
          </div>
        </div>
        {status === "ready" && <StatusChip status={healthStatus(health)} />}
      </div>

      {status === "loading" && (
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          {COPY.loading}
        </div>
      )}

      {status === "loadError" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 13, color: "var(--status-expired-fg)" }}>
            {COPY.loadError}
          </div>
          <Button variant="secondary" size="sm" onClick={load}>
            {COPY.retry}
          </Button>
        </div>
      )}

      {status === "ready" && health !== null && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <HealthGrid health={health} />
          <ErrorBreakdown health={health} />
        </div>
      )}
    </Card>
  );
}

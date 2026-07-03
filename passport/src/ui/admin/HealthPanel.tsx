import { useCallback, useEffect, useState } from "react";
import { Button } from "../../design/components/index.ts";
import { StatusLabel } from "../editorial/StatusLabel.tsx";
import { humanBytes } from "./MetricsPanel.tsx";
import "./admin.css";
import type { AdminHealth, AdminHealthResult } from "./adminOpsApi.ts";

// The health panel (doc 20): a read-only, at-a-glance view of how the box is running
// right now, at the top of the console. A single status word (StatusLabel) summarizes
// it, the figures below break it down (errors, send queue, background-loop heartbeat,
// concurrency). Every figure is a count, an age, or a system size, never a per-account
// or per-id value (doc 12), so it stays within the blind-store boundary.

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
  statusOk: "All clear",
  statusWarn: "Needs a look",
  statusUnknown: "Health unknown",
  errorsLabel: "Errors today",
  lifetimeNote: "all time",
  queueLabel: "Send queue",
  loopLabel: "Background loop",
  inflightLabel: "In flight",
  neverRan: "no tick yet",
  queueClear: "empty",
  noErrors: "none today",
  buildLabel: "Build",
  uptimeLabel: "Up for",
  diskLabel: "Disk free",
} as const;

// How long the oldest queued send may sit, or the background loop may go between
// ticks, before the status turns from "all clear" to "needs a look". Generous, so a
// brief blip does not cry wolf; a genuinely stuck drain or a stalled loop grows well
// past these. The loop threshold clears a slow janitor interval (STI_JANITOR_INTERVAL
// defaults to 1 min but is operator-configurable) with wide margin, so a healthy box
// on a longer tick never flickers amber; the metrics-scrape alert catches a real
// stall in real time regardless, this word is the at-a-glance echo.
const QUEUE_STUCK_SECONDS = 300;
const LOOP_STALE_SECONDS = 900;

type HealthTone = "ok" | "warn" | "unknown";

export interface HealthStatus {
  tone: HealthTone;
  label: string;
}

// Sum the lifetime totals across subsystems. They survive restarts (the metrics
// snapshot), so this is history, not a fire signal.
function totalErrors(h: AdminHealth): number {
  return h.errors.reduce((sum, e) => sum + e.count, 0);
}

// Sum TODAY's bucket only: the is-it-on-fire-now read the status word keys off.
function errorsToday(h: AdminHealth): number {
  return h.errorsToday.reduce((sum, e) => sum + e.count, 0);
}

// Reduce the snapshot to one status: "needs a look" if an internal error was
// logged TODAY, the send queue is stuck draining, or the background loop has
// gone stale; otherwise "all clear". The lifetime totals deliberately do not
// trip this: they survive restarts, so an old incident must not keep the box
// amber forever (that ambiguity is exactly what the per-day buckets fixed).
// A never-run loop (age -1) is a fresh boot, not a stall.
export function healthStatus(h: AdminHealth | null): HealthStatus {
  if (h === null) return { tone: "unknown", label: COPY.statusUnknown };
  const stuckQueue = h.sendQueueOldestAgeSeconds > QUEUE_STUCK_SECONDS;
  const staleLoop = h.janitorAgeSeconds > LOOP_STALE_SECONDS;
  if (errorsToday(h) > 0 || stuckQueue || staleLoop) {
    return { tone: "warn", label: COPY.statusWarn };
  }
  return { tone: "ok", label: COPY.statusOk };
}

// Status tone to the editorial StatusLabel tone: clear (green) for all-clear, treat
// (amber) for needs-a-look, none (grey) for an unknown/failed read.
const STATUS_TONE: Record<HealthTone, "clear" | "treat" | "none"> = {
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

function Figure({
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
    <div className={warn ? "adm-figure adm-figure--warn" : "adm-figure"}>
      <div className="adm-figure__value">{value}</div>
      <div className="adm-figure__label">{label}</div>
      {note !== undefined && <div className="adm-figure__note">{note}</div>}
    </div>
  );
}

// The per-subsystem breakdown of TODAY's errors, shown only when something was
// logged today (an all-clear day shows a plain "none today" instead of zeros).
function ErrorBreakdown({ health }: { health: AdminHealth }) {
  const nonzero = health.errorsToday.filter((e) => e.count > 0);
  if (nonzero.length === 0) {
    return (
      <div className="adm-note">
        {COPY.errorsLabel}: {COPY.noErrors}.
      </div>
    );
  }
  return (
    <div className="adm-note">
      {COPY.errorsLabel}:{" "}
      {nonzero
        .map((e) => `${ERROR_LABEL[e.type] ?? e.type} ${e.count}`)
        .join(" · ")}
    </div>
  );
}

// The box strip: which binary is running, for how long, and how much disk is
// left under the database. System facts the operator otherwise SSHes for.
function BoxStrip({ health }: { health: AdminHealth }) {
  if (!health.buildVersion && health.uptimeSeconds === 0) return null;
  const parts = [
    health.buildVersion ? `${COPY.buildLabel} ${health.buildVersion}` : "",
    `${COPY.uptimeLabel} ${humanAge(health.uptimeSeconds)}`,
    health.diskFreeBytes > 0
      ? `${COPY.diskLabel} ${humanBytes(health.diskFreeBytes)}`
      : "",
  ].filter(Boolean);
  return <div className="adm-note adm-note--mono">{parts.join(" · ")}</div>;
}

function HealthFigures({ health }: { health: AdminHealth }) {
  const errs = errorsToday(health);
  const lifetime = totalErrors(health);
  const queueNote =
    health.sendQueueDepth > 0
      ? `oldest ${humanAge(health.sendQueueOldestAgeSeconds)}`
      : COPY.queueClear;
  const loopValue =
    health.janitorAgeSeconds < 0
      ? COPY.neverRan
      : humanAge(health.janitorAgeSeconds);
  return (
    <div className="adm-figures">
      <Figure
        label={COPY.errorsLabel}
        value={errs.toLocaleString("en-US")}
        note={`${lifetime.toLocaleString("en-US")} ${COPY.lifetimeNote}`}
        warn={errs > 0}
      />
      <Figure
        label={COPY.queueLabel}
        value={health.sendQueueDepth.toLocaleString("en-US")}
        note={queueNote}
        warn={health.sendQueueOldestAgeSeconds > QUEUE_STUCK_SECONDS}
      />
      <Figure
        label={COPY.loopLabel}
        value={loopValue}
        warn={health.janitorAgeSeconds > LOOP_STALE_SECONDS}
      />
      <Figure
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
  onStatusChange,
  refreshSignal = 0,
}: {
  token: string;
  ops: HealthOps;
  onUnauthorized: () => void;
  // Reports whether the box needs a look, so the shell can mark the Overview
  // tab from anywhere in the console.
  onStatusChange?: ((needsLook: boolean) => void) | undefined;
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

  const st = healthStatus(health);
  useEffect(() => {
    onStatusChange?.(st.tone === "warn");
  }, [st.tone, onStatusChange]);
  return (
    <section className="adm-panel adm-panel--health">
      <div className="adm-panel__head">
        <div className="adm-panel__headings">
          <h2 className="adm-panel__title">{COPY.title}</h2>
          <div className="adm-panel__sub">{COPY.sub}</div>
        </div>
        {status === "ready" && (
          <StatusLabel label={st.label} tone={STATUS_TONE[st.tone]} />
        )}
      </div>

      {status === "loading" && <div className="adm-note">{COPY.loading}</div>}

      {status === "loadError" && (
        <div className="adm-retry">
          <div className="adm-error">{COPY.loadError}</div>
          <Button variant="secondary" size="sm" onClick={load}>
            {COPY.retry}
          </Button>
        </div>
      )}

      {status === "ready" && health !== null && (
        <>
          <HealthFigures health={health} />
          <ErrorBreakdown health={health} />
          <BoxStrip health={health} />
        </>
      )}
    </section>
  );
}

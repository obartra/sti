import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./admin.css";

// The console's shared chart pieces (doc 20): one grammar for every panel that
// draws a series, so Usage, Queues, Errors, and Performance read as one
// dashboard. Every series is aggregate and identifier-free (daily counts of
// opaque events, time buckets), and every chart renders its final frame
// synchronously: recharts drives its enter animation with requestAnimationFrame
// (react-smooth), which outruns the visual-capture settle wait and drifts
// baselines, so isAnimationActive is always false here.

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** A compact integer (1,234) so big totals stay readable. */
function humanCount(n: number): string {
  return n.toLocaleString("en-US");
}

/** An epoch-day (days since the Unix epoch, UTC) to a short "Jun 25" label.
 * UTC so the bucket boundary matches the server's. */
export function dayLabel(epochDay: number): string {
  return new Date(epochDay * DAY_MS).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** A latency bucket's upper bound (ms) to a short "< 6h" / "< 3d" / "< 25ms"
 * label. The 0 bound is the trailing overflow, shown as "older" for queue
 * waits and "slower" for request latency; callers pick via overflowLabel. */
function latencyLabel(underMs: number, overflow = "older"): string {
  if (underMs === 0) return overflow;
  if (underMs < 1000) return `< ${underMs}ms`;
  if (underMs < DAY_MS) {
    if (underMs < HOUR_MS) return `< ${Math.round(underMs / 1000)}s`;
    return `< ${Math.round(underMs / HOUR_MS)}h`;
  }
  return `< ${Math.round(underMs / DAY_MS)}d`;
}

/** The shared uppercase caption above each chart, in the editorial eyebrow style. */
function ChartLabel({ text }: { text: string }) {
  return <div className="e-eyebrow">{text}</div>;
}

const AXIS_TICK = { fontSize: 12, fill: "var(--text-muted)" } as const;

/** An area chart of one per-day count series (reports filed, accounts created,
 * requests served). An empty window renders a bare axis; `unit` names the
 * series in the tooltip. */
export function DailyAreaChart({
  title,
  series,
  unit,
}: {
  title: string;
  series: { day: number; count: number }[];
  unit: string;
}) {
  const data = series.map((d) => ({ label: dayLabel(d.day), count: d.count }));
  return (
    <div className="adm-chart">
      <ChartLabel text={title} />
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart
          data={data}
          margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
        >
          <XAxis
            dataKey="label"
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            allowDecimals={false}
            width={36}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip formatter={(v) => [humanCount(Number(v ?? 0)), unit]} />
          <Area
            dataKey="count"
            stroke="var(--text-accent)"
            fill="var(--accent-soft)"
            strokeWidth={2}
            type="monotone"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** A bar chart of a bucketed histogram (queue waits, request latency). */
export function BucketBarChart({
  title,
  buckets,
  unit,
  overflowLabel = "older",
}: {
  title: string;
  buckets: { underMs: number; count: number }[];
  unit: string;
  overflowLabel?: string;
}) {
  const data = buckets.map((b) => ({
    label: latencyLabel(b.underMs, overflowLabel),
    count: b.count,
  }));
  return (
    <div className="adm-chart">
      <ChartLabel text={title} />
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="label"
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            width={36}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "var(--accent-soft)" }}
            formatter={(v) => [humanCount(Number(v ?? 0)), unit]}
          />
          <Bar
            dataKey="count"
            fill="var(--text-accent)"
            radius={[4, 4, 0, 0]}
            maxBarSize={56}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** One series of a stacked daily bar chart (the errors-by-subsystem chart):
 * a data key plus the ink it stacks with. */
export interface StackedSeries {
  key: string;
  label: string;
  color: string;
}

/** A stacked bar chart of several per-day series sharing one axis (errors by
 * subsystem). Rows carry a `label` plus one numeric field per series key. */
export function DailyStackedBars({
  title,
  rows,
  series,
}: {
  title: string;
  rows: Record<string, number | string>[];
  series: StackedSeries[];
}) {
  return (
    <div className="adm-chart">
      <ChartLabel text={title} />
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="label"
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            allowDecimals={false}
            width={36}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip cursor={{ fill: "var(--accent-soft)" }} />
          {series.map((s) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stackId="a"
              fill={s.color}
              maxBarSize={24}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

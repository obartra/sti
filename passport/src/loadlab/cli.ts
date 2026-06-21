/**
 * Operator entry point for the load & usage lab's stress plane (doc 14 §10). This
 * is NOT a CI gate: the gated invariants run via `test:integration` / `test:e2e`.
 * This drives real volume and prints capacity numbers.
 *
 *   npm run loadlab -- --mode stress --size small
 *   npm run loadlab -- --mode normal --size medium
 *   npm run loadlab -- --mode stress --target http://host:port   (a DEDICATED box)
 *
 * --target defaults to a hermetic throwaway instance (built + booted here, then
 * destroyed). NEVER point --target at production: this generates overload and the
 * lab cannot clear a shared prod store (no per-id delete).
 */
import { startApi, type Harness } from "../test-support/serverHarness.ts";
import { createApiClient, type ApiClient } from "../api/client.ts";
import { scrapeMetrics } from "./metrics.ts";
import { seedOwners } from "./seed.ts";
import { driveMix } from "./load.ts";
import {
  findShedOnset,
  measureReadCeiling,
  measureTimingGap,
} from "./stress.ts";

type Size = "small" | "medium" | "large";
type Mode = "normal" | "stress";

interface Args {
  size: Size;
  mode: Mode;
  target: string | undefined;
}

const SIZES: readonly Size[] = ["small", "medium", "large"];
const MODES: readonly Mode[] = ["normal", "stress"];

// A hermetic box handles a decoy read in well under a millisecond, so even 500
// client workers rarely reach the real 256 cap. For the hermetic stress DEMO we
// cap inflight low so the shed onset is observable; a --target dedicated box is
// driven at its real cap. The number is indicative either way (co-located).
const DEMO_CAP = "64";

// Per-size load shapes. Kept modest so a hermetic local run finishes quickly; a
// dedicated run can be scaled up by editing these. Stress levels straddle the
// default MaxInflight (256) so the shed onset is visible.
const NORMAL: Record<Size, { ops: number; concurrency: number }> = {
  small: { ops: 2000, concurrency: 25 },
  medium: { ops: 10000, concurrency: 100 },
  large: { ops: 30000, concurrency: 250 },
};
const STRESS: Record<
  Size,
  {
    levels: number[];
    opsPerLevel: number;
    ceilingOps: number;
    ceilingConc: number;
  }
> = {
  small: {
    levels: [50, 150, 300, 500],
    opsPerLevel: 1500,
    ceilingOps: 5000,
    ceilingConc: 100,
  },
  medium: {
    levels: [100, 300, 600, 1000],
    opsPerLevel: 3000,
    ceilingOps: 10000,
    ceilingConc: 150,
  },
  large: {
    levels: [200, 500, 1000, 2000],
    opsPerLevel: 5000,
    ceilingOps: 20000,
    ceilingConc: 200,
  },
};

function parseArgs(argv: readonly string[]): Args {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const size = get("--size") ?? "small";
  const mode = get("--mode") ?? "normal";
  if (!SIZES.includes(size as Size))
    throw new Error(`--size must be one of ${SIZES.join("/")}`);
  if (!MODES.includes(mode as Mode))
    throw new Error(`--mode must be one of ${MODES.join("/")}`);
  return { size: size as Size, mode: mode as Mode, target: get("--target") };
}

interface Ctx {
  baseUrl: string;
  client: ApiClient;
  metricsUrl: string | undefined;
  stop: () => void;
}

async function setup(
  target: string | undefined,
  env: Readonly<Record<string, string>>,
): Promise<Ctx> {
  if (target !== undefined) {
    return {
      baseUrl: target,
      client: createApiClient(target),
      metricsUrl: process.env.STI_METRICS_URL,
      stop: () => undefined,
    };
  }
  const h: Harness = await startApi({ metrics: true, env });
  return {
    baseUrl: h.baseUrl,
    client: createApiClient(h.baseUrl),
    metricsUrl: h.metricsUrl,
    stop: h.stop,
  };
}

async function reportInflight(metricsUrl: string | undefined): Promise<void> {
  if (metricsUrl === undefined) return;
  const m = await scrapeMetrics(metricsUrl);
  console.log(
    `  metrics: inflight high-water ${m.gauge("sti_inflight_highwater")}/${m.gauge("sti_inflight_max")}, ` +
      `shed ${m.sum("sti_shed_total")}, sensitive-overload ${m.sum("sti_sensitive_overload_total")}`,
  );
}

async function runNormal(ctx: Ctx, size: Size): Promise<void> {
  const { ops, concurrency } = NORMAL[size];
  const owners = await seedOwners(ctx.client, 24);
  console.log(
    `normal / ${size}: ${ops} ops @ concurrency ${concurrency} (read-skewed mix)`,
  );
  const mix = await driveMix(ctx.client, owners, { ops, concurrency });
  console.log(
    `  mix: ${mix.getReal} real reads, ${mix.getDecoy} decoy, ${mix.knock} knocks, ${mix.accountGet} acct`,
  );
  const ceiling = await measureReadCeiling(
    ctx.client,
    Math.min(ops, 5000),
    concurrency,
  );
  console.log(
    `  read path: ~${ceiling.achievedRps} req/s, p50 ${ceiling.latency.p50ms}ms, p99 ${ceiling.latency.p99ms}ms`,
  );
  await reportInflight(ctx.metricsUrl);
}

async function reportTimingGap(client: ApiClient): Promise<void> {
  const owners = await seedOwners(client, 4);
  const first = owners[0];
  if (first === undefined) return;
  const gap = await measureTimingGap(client, first.aliasId, 200);
  console.log(
    `  read timing (characterized, co-located so noisy): hit p50 ${gap.hit.p50ms}ms vs decoy p50 ${gap.miss.p50ms}ms`,
  );
}

async function runStress(
  ctx: Ctx,
  size: Size,
  demoCap: number | null,
): Promise<void> {
  const cfg = STRESS[size];
  console.log(
    `stress / ${size} (indicative on a hermetic box; authoritative on a dedicated one)`,
  );
  if (demoCap !== null) {
    console.log(
      `  hermetic demo: MaxInflight capped to ${demoCap} so the shed onset is observable; a dedicated --target uses its real cap`,
    );
  }
  const ceiling = await measureReadCeiling(
    ctx.client,
    cfg.ceilingOps,
    cfg.ceilingConc,
  );
  console.log(
    `  read ceiling: ~${ceiling.achievedRps} req/s, p50 ${ceiling.latency.p50ms}ms, p99 ${ceiling.latency.p99ms}ms`,
  );
  await reportTimingGap(ctx.client);
  const report = await findShedOnset(ctx.baseUrl, cfg.levels, cfg.opsPerLevel);
  for (const l of report.levels) {
    console.log(
      `  conc ${String(l.concurrency).padStart(4)}: ~${String(l.achievedRps).padStart(6)} req/s, ` +
        `p99 ${String(l.latency.p99ms).padStart(4)}ms, rejected ${l.rejected}`,
    );
  }
  console.log(
    report.onsetConcurrency === null
      ? `  no rejection up to concurrency ${cfg.levels[cfg.levels.length - 1]}; the box absorbed it`
      : `  shed onset (capacity breakpoint): concurrency ${report.onsetConcurrency}`,
  );
  await reportInflight(ctx.metricsUrl);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  // Fold STI_API_BASE_URL into the target: startApi honors it on the "hermetic"
  // path, so without this a stray env var could point a stress run at prod while
  // presenting as hermetic. Guarding the resolved target closes that bypass.
  const target = args.target ?? process.env.STI_API_BASE_URL;
  if (target?.includes("sti.care")) {
    throw new Error("refusing to run against a production-looking target");
  }
  const hermetic = target === undefined;
  const env =
    hermetic && args.mode === "stress" ? { STI_MAX_INFLIGHT: DEMO_CAP } : {};
  const ctx = await setup(target, env);
  try {
    if (args.mode === "stress") {
      await runStress(ctx, args.size, hermetic ? Number(DEMO_CAP) : null);
    } else {
      await runNormal(ctx, args.size);
    }
  } finally {
    ctx.stop();
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});

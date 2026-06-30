/**
 * The stress plane (doc 14 §4 / §6b): ramp load against a target to find where it
 * degrades, and measure the hot-read throughput. It REPORTS numbers; it does not
 * assert (the gated degradation invariants live in the integration suite). Honest
 * about altitude: a hermetic local run co-locates generator and server, so these
 * figures are indicative; a dedicated instance gives authoritative ones.
 */
import { performance } from "node:perf_hooks";
import type { ApiClient } from "../api/client.ts";
import { randomAliasId } from "../crypto/index.ts";

export interface LatencyStats {
  count: number;
  p50ms: number;
  p99ms: number;
  maxMs: number;
}

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  // Nearest-rank: the ceil(p/100 * n)-th sample (1-based), clamped. Using floor
  // would push p99 of 100 samples onto the max; this keeps the tail honest.
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[idx] ?? 0;
}

function stats(samples: number[]): LatencyStats {
  const s = [...samples].sort((a, b) => a - b);
  return {
    count: s.length,
    p50ms: Math.round(percentile(s, 50)),
    p99ms: Math.round(percentile(s, 99)),
    maxMs: Math.round(s[s.length - 1] ?? 0),
  };
}

// Fire `ops` calls of `fn` across `concurrency` workers, timing each call.
async function burst(
  fn: () => Promise<number>,
  ops: number,
  concurrency: number,
): Promise<{ latencies: number[]; statuses: Map<number, number> }> {
  const latencies: number[] = [];
  const statuses = new Map<number, number>();
  let remaining = ops;
  const worker = async (): Promise<void> => {
    while (remaining > 0) {
      remaining--;
      const t0 = performance.now();
      const status = await fn();
      latencies.push(performance.now() - t0);
      statuses.set(status, (statuses.get(status) ?? 0) + 1);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return { latencies, statuses };
}

interface RampLevel {
  concurrency: number;
  achievedRps: number;
  latency: LatencyStats;
  rejected: number; // 429 (rate limit) or 503 (inflight cap)
}

export interface ShedReport {
  levels: RampLevel[];
  onsetConcurrency: number | null; // first level where the box rejected requests
}

// Ramp a non-sensitive request (raw GET /acct) at increasing concurrency until
// the box starts rejecting (429 from the per-IP limit on a real box, or 503 from
// the inflight cap when the limit is lifted). The onset is where excess is shed
// cleanly rather than the box falling over.
export async function findShedOnset(
  baseUrl: string,
  levels: readonly number[],
  opsPerLevel: number,
): Promise<ShedReport> {
  const out: RampLevel[] = [];
  let onset: number | null = null;
  for (const c of levels) {
    const t0 = performance.now();
    const { latencies, statuses } = await burst(
      () => fetch(`${baseUrl}/acct/${randomAliasId()}`).then((r) => r.status),
      opsPerLevel,
      c,
    );
    const secs = (performance.now() - t0) / 1000;
    const rejected = (statuses.get(503) ?? 0) + (statuses.get(429) ?? 0);
    out.push({
      concurrency: c,
      achievedRps: Math.round(opsPerLevel / secs),
      latency: stats(latencies),
      rejected,
    });
    if (onset === null && rejected > 0) onset = c;
  }
  return { levels: out, onsetConcurrency: onset };
}

// Characterize the read-path timing side-channel (doc 14 §6c): time sequential
// reads of a real, seeded id (a hit) against random ids (decoy misses). On a
// co-located box this is noisy and only indicative; it tracks whether a gap
// exists until the constant-time read fix closes it.
export async function measureTimingGap(
  client: ApiClient,
  realId: string,
  ops: number,
): Promise<{ hit: LatencyStats; miss: LatencyStats }> {
  const time = async (pick: () => string): Promise<number[]> => {
    const lat: number[] = [];
    for (let i = 0; i < ops; i++) {
      const t0 = performance.now();
      try {
        await client.getAlias(pick());
      } catch {
        // a decoy miss still returns 200; ignore any opening failure here
      }
      lat.push(performance.now() - t0);
    }
    return lat;
  };
  return {
    hit: stats(await time(() => realId)),
    miss: stats(await time(() => randomAliasId())),
  };
}

// Drive the hot read (GET /a, decoys) at a fixed concurrency below the cap and
// report sustained throughput + latency.
export async function measureReadCeiling(
  client: ApiClient,
  ops: number,
  concurrency: number,
): Promise<{ achievedRps: number; latency: LatencyStats }> {
  const t0 = performance.now();
  const { latencies } = await burst(
    async () => {
      try {
        await client.getAlias(randomAliasId());
        return 200;
      } catch {
        return 0;
      }
    },
    ops,
    concurrency,
  );
  const secs = (performance.now() - t0) / 1000;
  return { achievedRps: Math.round(ops / secs), latency: stats(latencies) };
}

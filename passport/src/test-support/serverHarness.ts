// Shared harness for integration tests: boots a real instance of the Go blind
// store so the api client and store layers can be proven against it (not a
// mock). Built once per suite onto a free port with a throwaway SQLite db, torn
// down after. Set STI_API_BASE_URL to reuse an already-running instance instead;
// otherwise Go must be on PATH. Imported only by *.integration.test.ts, which
// run via vitest.integration.config.ts (node environment).
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

export interface Harness {
  baseUrl: string;
  /** Loopback Prometheus scrape URL; present only when started with `{ metrics: true }`. */
  metricsUrl?: string;
  /** The throwaway working dir and db file (hermetic runs only; absent for an external instance). */
  workDir?: string;
  dbPath?: string;
  stop: () => void;
}

export interface StartOptions {
  /** Bind the loopback metrics listener on its own free port so a caller can scrape it. */
  metrics?: boolean;
  /**
   * Extra env vars for the spawned server, merged AFTER the harness defaults so a
   * test can override them (e.g. restore the default rate limit with
   * `STI_IP_RATE_PER_SEC: "5"`, or shrink `STI_MAX_INFLIGHT` to force shedding).
   */
  env?: Readonly<Record<string, string>>;
}

export function freePort(): Promise<number> {
  return new Promise((res, rej) => {
    const srv = createServer();
    srv.on("error", rej);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      if (addr === null || typeof addr === "string") {
        rej(new Error("no port"));
        return;
      }
      const { port } = addr;
      srv.close(() => res(port));
    });
  });
}

export function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

async function waitForHealth(baseUrl: string, attempts = 80): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(baseUrl + "/healthz");
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`server at ${baseUrl} never became healthy`);
}

interface SpawnSpec {
  work: string;
  port: number;
  dbPath: string;
  metricsAddr: string; // "off" or a loopback host:port for callers that scrape
  extraEnv: Readonly<Record<string, string>>;
}

// Build the server binary once and spawn it against a throwaway db on `port`.
function spawnServer(o: SpawnSpec): ChildProcess {
  const serverDir = resolve(process.cwd(), "..", "server");
  const bin = join(o.work, "stiapi");
  execFileSync("go", ["build", "-o", bin, "./cmd/stiapi"], {
    cwd: serverDir,
    stdio: "inherit",
  });
  return spawn(bin, [], {
    env: {
      ...process.env,
      STI_ADDR: `127.0.0.1:${o.port}`,
      STI_DB_PATH: o.dbPath,
      STI_DECOY_SECRET: randomHex(32),
      // The whole suite drives many writes from one loopback IP; the production
      // per-IP budget (5/sec, burst 20) would throttle it. Rate limiting has its
      // own Go-level coverage, so lift it here to keep these tests deterministic.
      STI_IP_RATE_PER_SEC: "100000",
      STI_IP_BURST: "100000",
      // Metrics listener is off by default (parallel integration servers would
      // contend for a fixed port); the load lab opts in on its own free port.
      STI_METRICS_ADDR: o.metricsAddr,
      // Per-test overrides last, so a test can restore a default or shrink a knob.
      ...o.extraEnv,
    },
    stdio: "ignore",
  });
}

// Boot a fresh throwaway instance on temp storage. Metrics get their own free
// port when requested, so a parallel run never contends for a fixed one.
async function startHermetic(opts: StartOptions): Promise<Harness> {
  const work = mkdtempSync(join(tmpdir(), "sti-itest-"));
  const dbPath = join(work, "itest.db");
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const metricsAddr = opts.metrics ? `127.0.0.1:${await freePort()}` : "off";
  const proc = spawnServer({
    work,
    port,
    dbPath,
    metricsAddr,
    extraEnv: opts.env ?? {},
  });
  const stop = () => {
    proc.kill("SIGKILL");
    rmSync(work, { recursive: true, force: true });
  };
  try {
    await waitForHealth(baseUrl);
  } catch (e) {
    stop();
    throw e;
  }
  return opts.metrics
    ? {
        baseUrl,
        metricsUrl: `http://${metricsAddr}`,
        workDir: work,
        dbPath,
        stop,
      }
    : { baseUrl, workDir: work, dbPath, stop };
}

export async function startApi(opts: StartOptions = {}): Promise<Harness> {
  const external = process.env.STI_API_BASE_URL;
  if (external) {
    await waitForHealth(external);
    return {
      baseUrl: external,
      stop: () => {
        /* external instance, nothing to tear down */
      },
    };
  }
  return startHermetic(opts);
}

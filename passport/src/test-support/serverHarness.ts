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
  stop: () => void;
}

function freePort(): Promise<number> {
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

// Build the server binary once and spawn it against a throwaway db on `port`.
function spawnServer(work: string, port: number): ChildProcess {
  const serverDir = resolve(process.cwd(), "..", "server");
  const bin = join(work, "stiapi");
  execFileSync("go", ["build", "-o", bin, "./cmd/stiapi"], {
    cwd: serverDir,
    stdio: "inherit",
  });
  return spawn(bin, [], {
    env: {
      ...process.env,
      STI_ADDR: `127.0.0.1:${port}`,
      STI_DB_PATH: join(work, "itest.db"),
      STI_DECOY_SECRET: randomHex(32),
      // No metrics listener for integration servers: they run in parallel and
      // would otherwise contend for the fixed metrics port. The metrics endpoint
      // has its own Go-level coverage.
      STI_METRICS_ADDR: "off",
    },
    stdio: "ignore",
  });
}

export async function startApi(): Promise<Harness> {
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

  const work = mkdtempSync(join(tmpdir(), "sti-itest-"));
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const proc = spawnServer(work, port);

  try {
    await waitForHealth(baseUrl);
  } catch (e) {
    proc.kill("SIGKILL");
    rmSync(work, { recursive: true, force: true });
    throw e;
  }

  return {
    baseUrl,
    stop: () => {
      proc.kill("SIGKILL");
      rmSync(work, { recursive: true, force: true });
    },
  };
}

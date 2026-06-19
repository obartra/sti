// @vitest-environment node
//
// The real round-trip: a typed client against a live instance of the Go blind
// store, proving data actually flows (publish -> resolve -> decrypt equals what
// was published), not just that the wiring compiles. Per doc 11, a mock would
// prove nothing here.
//
// The server is booted in-process: we build the Go binary once and run it on a
// free port against a throwaway SQLite db, then tear it down. Set
// STI_API_BASE_URL to run against an already-running instance instead (e.g. if
// CI starts the server out-of-band). Requires Go on PATH otherwise.
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApiClient, ApiError } from "./client.ts";
import { ALIAS_PAYLOAD_SIZE, ID_ENCODED_LEN } from "./contract.ts";
import {
  importAesKey,
  seal,
  open,
  sealToSize,
  openSized,
  utf8ToBytes,
  bytesToUtf8,
  randomAliasId,
  randomWriteToken,
  deriveMasterKey,
  deriveAccountId,
  deriveAccountKey,
} from "../crypto/index.ts";

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

function randomHex(bytes: number): string {
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

interface Harness {
  baseUrl: string;
  stop: () => void;
}

async function startApi(): Promise<Harness> {
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

  const serverDir = resolve(process.cwd(), "..", "server");
  const work = mkdtempSync(join(tmpdir(), "sti-itest-"));
  const bin = join(work, "stiapi");
  execFileSync("go", ["build", "-o", bin, "./cmd/stiapi"], {
    cwd: serverDir,
    stdio: "inherit",
  });

  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  let proc: ChildProcess | undefined = spawn(bin, [], {
    env: {
      ...process.env,
      STI_ADDR: `127.0.0.1:${port}`,
      STI_DB_PATH: join(work, "itest.db"),
      STI_DECOY_SECRET: randomHex(32),
    },
    stdio: "ignore",
  });

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
      proc?.kill("SIGKILL");
      proc = undefined;
      rmSync(work, { recursive: true, force: true });
    },
  };
}

describe("api client against a live blind store", () => {
  let harness: Harness | undefined;
  let api!: ReturnType<typeof createApiClient>;

  beforeAll(async () => {
    harness = await startApi();
    api = createApiClient(harness.baseUrl);
  }, 120_000);

  afterAll(() => harness?.stop());

  it("reports healthy", async () => {
    expect(await api.health()).toBe(true);
  });

  it("round-trips an alias: publish, resolve, decrypt equals published", async () => {
    const id = randomAliasId();
    const writeToken = randomWriteToken();
    expect(id).toHaveLength(ID_ENCODED_LEN);
    const key = await importAesKey(crypto.getRandomValues(new Uint8Array(32)));

    const plaintext = utf8ToBytes(
      JSON.stringify({ handle: "robin", badge: "blue", labels: ["hiv"] }),
    );
    const payload = await sealToSize(key, plaintext, ALIAS_PAYLOAD_SIZE);
    await api.putAlias(id, payload, writeToken);

    const fetched = await api.getAlias(id);
    // Drift guard: the server's fixed size must match the contract constant.
    expect(fetched.length).toBe(ALIAS_PAYLOAD_SIZE);
    expect(bytesToUtf8(await openSized(key, fetched))).toBe(
      bytesToUtf8(plaintext),
    );
  });

  it("a miss is existence-uniform: same fixed size, fails to open like a wrong key", async () => {
    const key = await importAesKey(crypto.getRandomValues(new Uint8Array(32)));

    const missId = randomAliasId(); // never written
    const decoy = await api.getAlias(missId);
    expect(decoy.length).toBe(ALIAS_PAYLOAD_SIZE); // identical size to a real one
    await expect(openSized(key, decoy)).rejects.toThrow(); // -> null resolution

    // A real payload opened with the wrong key fails the same way, so a viewer
    // cannot tell "does not exist" from "exists, not for me".
    const id = randomAliasId();
    const realKey = await importAesKey(
      crypto.getRandomValues(new Uint8Array(32)),
    );
    await api.putAlias(
      id,
      await sealToSize(realKey, utf8ToBytes("real"), ALIAS_PAYLOAD_SIZE),
      randomWriteToken(),
    );
    const real = await api.getAlias(id);
    expect(real.length).toBe(ALIAS_PAYLOAD_SIZE);
    await expect(openSized(key, real)).rejects.toThrow();
  });

  it("rejects an overwrite with the wrong write token", async () => {
    const id = randomAliasId();
    const key = await importAesKey(crypto.getRandomValues(new Uint8Array(32)));
    const payload = await sealToSize(
      key,
      utf8ToBytes("v1"),
      ALIAS_PAYLOAD_SIZE,
    );
    await api.putAlias(id, payload, randomWriteToken());

    const err = await api
      .putAlias(id, payload, randomWriteToken())
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).kind).toBe("forbidden");
  });

  it("round-trips the account-sync blob and reports a version", async () => {
    const master = await deriveMasterKey(
      "recovery phrase",
      utf8ToBytes("salt"),
    );
    const accountId = await deriveAccountId(master);
    const key = await importAesKey(await deriveAccountKey(master));

    expect(await api.getAccount(accountId)).toBeNull(); // empty account

    const plaintext = utf8ToBytes(
      JSON.stringify({ aliases: ["a", "b"], circles: [] }),
    );
    const put = await api.putAccount(accountId, await seal(key, plaintext));
    expect(put.version).toBeTruthy();

    const got = await api.getAccount(accountId);
    if (got === null) throw new Error("expected an account blob");
    expect(bytesToUtf8(await open(key, got.blob))).toBe(bytesToUtf8(plaintext));
  });

  it("knock and notify complete without leaking existence", async () => {
    const id = randomAliasId();
    await expect(api.knock(id, randomHex(16))).resolves.toBeUndefined();
    await expect(api.notify(randomHex(16))).resolves.toBeUndefined();
  });
});

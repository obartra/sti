// @vitest-environment node
//
// The load & usage lab (doc 13). It stands up a throwaway blind store with the
// metrics endpoint on, seeds a synthetic owner population through the real client
// + crypto, drives a realistic mix, and asserts the product behaviors a single
// request test cannot reach. Each assertion is tagged with a behavior id from the
// catalog (./behaviors.json); a meta-test fails if the catalog and the suite
// drift. Runs via vitest.integration.config.ts (npm run test:integration); needs
// Go on PATH.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync } from "node:fs";

import { ApiError, createApiClient } from "../api/client.ts";
import { ALIAS_PAYLOAD_SIZE, HEADER_WRITE_TOKEN } from "../api/contract.ts";
import {
  importAesKey,
  openSized,
  seal,
  sealToSize,
  open,
  utf8ToBytes,
  bytesToUtf8,
  bytesToBase64url,
  randomAliasId,
  randomWriteToken,
  deriveAccountId,
  deriveAccountKey,
} from "../crypto/index.ts";
import { startApi, type Harness } from "../test-support/serverHarness.ts";
import { scrapeMetrics } from "./metrics.ts";
import { seedOwners, type SeededOwner } from "./seed.ts";
import { driveMix } from "./load.ts";
import {
  BEHAVIORS,
  CATEGORY_ORDER,
  LAYERS,
  STATUSES,
  LOADLAB_PIN,
  behavior,
} from "./behaviors.ts";

const OWNERS = 24;
const GET_2XX =
  'sti_requests_total{endpoint="/a/{id}",method="GET",status_class="2xx"}';

describe("load & usage lab: behavior gates against a real blind store", () => {
  let harness: Harness | undefined;
  let api!: ReturnType<typeof createApiClient>;
  let baseUrl!: string;
  let metricsUrl!: string;
  let owners: SeededOwner[] = [];

  // Tag a test with one or more catalog behavior ids. Recording happens at
  // registration time, so the catalog-sync meta-test sees the full set.
  const covered = new Set<string>();
  function behaviorIt(
    ids: string | readonly string[],
    fn: () => void | Promise<void>,
  ): void {
    const list = typeof ids === "string" ? [ids] : ids;
    for (const id of list) {
      behavior(id); // throws if the id is not in the catalog
      covered.add(id);
    }
    const titles = list.map((id) => behavior(id).title).join(" + ");
    it(`${titles} [${list.join(", ")}]`, fn);
  }

  function ownerAt(i: number): SeededOwner {
    const o = owners[i];
    if (o === undefined) throw new Error("owners not seeded yet");
    return o;
  }

  // Spin a tailored throwaway instance (its own env) for behaviors that need a
  // non-default config, run fn against it, and always tear it down.
  async function withInstance(
    env: Readonly<Record<string, string>>,
    fn: (
      h: Harness,
      client: ReturnType<typeof createApiClient>,
      metrics: string,
    ) => Promise<void>,
  ): Promise<void> {
    const h = await startApi({ metrics: true, env });
    try {
      if (h.metricsUrl === undefined) throw new Error("metrics not enabled");
      await fn(h, createApiClient(h.baseUrl), h.metricsUrl);
    } finally {
      h.stop();
    }
  }

  beforeAll(async () => {
    // A fast janitor so the heartbeat advances within a test (no-leak-recovery);
    // harmless otherwise (nothing is expired at the default knock TTL).
    harness = await startApi({
      metrics: true,
      env: { STI_JANITOR_INTERVAL: "500ms" },
    });
    if (harness.metricsUrl === undefined) {
      throw new Error("metrics endpoint not enabled");
    }
    baseUrl = harness.baseUrl;
    metricsUrl = harness.metricsUrl;
    api = createApiClient(baseUrl);
  }, 120_000);

  afterAll(() => harness?.stop());

  it("catalog is well-formed; the load lab covers what it pins; every pin exists", () => {
    const ids = new Set(BEHAVIORS.map((b) => b.id));
    expect(ids.size).toBe(BEHAVIORS.length); // ids are unique
    for (const b of BEHAVIORS) {
      expect(STATUSES).toContain(b.status);
      expect(LAYERS).toContain(b.layer);
      expect(CATEGORY_ORDER).toContain(b.category);
      expect(b.title.length).toBeGreaterThan(0);
      expect(b.intent.length).toBeGreaterThan(0);
      expect(b.check.length).toBeGreaterThan(0);
      expect(b.pin.length).toBeGreaterThan(0);
      // The pinning suite/module must exist, so the catalog can never name a
      // vanished test (cwd is passport/; a Go pin is "../server/...").
      expect(existsSync(b.pin)).toBe(true);
    }
    // Every load-lab-pinned validated behavior is actually tagged by a test here.
    const owned = BEHAVIORS.filter(
      (b) => b.pin === LOADLAB_PIN && b.status === "validated",
    );
    for (const b of owned) expect(covered.has(b.id)).toBe(true);
    // And every tagged test names a load-lab-pinned behavior (no ghosts, and no
    // tagging a behavior another suite owns).
    for (const id of covered) {
      expect(BEHAVIORS.find((x) => x.id === id)?.pin).toBe(LOADLAB_PIN);
    }
  });

  it("baseline: no rows and no errors before seeding", async () => {
    const m = await scrapeMetrics(metricsUrl);
    expect(m.gauge("sti_alias_rows")).toBe(0);
    expect(m.gauge("sti_account_rows")).toBe(0);
    expect(m.sum("sti_errors_total")).toBe(0);
  });

  behaviorIt("metrics-rows-match-store", async () => {
    owners = await seedOwners(api, OWNERS);
    const m = await scrapeMetrics(metricsUrl);
    expect(m.gauge("sti_alias_rows")).toBe(OWNERS);
    expect(m.gauge("sti_account_rows")).toBe(OWNERS);
  });

  behaviorIt("no-lost-writes", async () => {
    for (const o of owners) {
      const fetched = await api.getAlias(o.aliasId);
      expect(fetched.length).toBe(ALIAS_PAYLOAD_SIZE);
      const opened = await openSized(
        await importAesKey(o.aliasKeyRaw),
        fetched,
      );
      expect(bytesToUtf8(opened)).toBe(bytesToUtf8(o.aliasPlaintext));
    }
  });

  behaviorIt(["alias-read-uniform", "knock-reply-uniform"], async () => {
    const o = ownerAt(0);
    const real = await api.getAlias(o.aliasId);
    const decoy = await api.getAlias(randomAliasId()); // never written
    expect(real.length).toBe(ALIAS_PAYLOAD_SIZE);
    expect(decoy.length).toBe(ALIAS_PAYLOAD_SIZE);
    await expect(api.knock(o.aliasId, "req-a")).resolves.toBeUndefined();
    await expect(api.knock(randomAliasId(), "req-b")).resolves.toBeUndefined();
  });

  behaviorIt("decoy-on-miss-deterministic", async () => {
    const id = randomAliasId(); // never written
    const a = await api.getAlias(id);
    const b = await api.getAlias(id);
    expect(a.length).toBe(ALIAS_PAYLOAD_SIZE);
    expect(bytesToBase64url(a)).toBe(bytesToBase64url(b)); // stable across reads
  });

  behaviorIt("account-version-monotonic", async () => {
    const o = ownerAt(1);
    const key = await importAesKey(o.accountKeyRaw);
    const ptA = utf8ToBytes(JSON.stringify({ v: "A" }));
    const ptB = utf8ToBytes(JSON.stringify({ v: "B" }));
    const [ra, rb] = await Promise.all([
      api.putAccount(o.accountId, await seal(key, ptA)),
      api.putAccount(o.accountId, await seal(key, ptB)),
    ]);
    expect(ra.version).not.toBe(rb.version);
    const finalRes = await api.getAccount(o.accountId);
    if (finalRes === null) throw new Error("account vanished after writes");
    const maxV = Math.max(Number(ra.version), Number(rb.version));
    expect(Number(finalRes.version)).toBe(maxV);
    const finalPt = bytesToUtf8(await open(key, finalRes.blob));
    expect([bytesToUtf8(ptA), bytesToUtf8(ptB)]).toContain(finalPt); // not torn
  });

  behaviorIt(["knock-cap-silent", "knock-isolated-per-requester"], async () => {
    const o = ownerAt(2);
    const flood = Array.from({ length: 20 }, () =>
      api.knock(o.aliasId, "flooder"),
    );
    await expect(Promise.all(flood)).resolves.toBeDefined(); // no visible 429
    const before = (await scrapeMetrics(metricsUrl)).gauge("sti_knock_rows");
    await api.knock(o.aliasId, "second-requester");
    const after = (await scrapeMetrics(metricsUrl)).gauge("sti_knock_rows");
    expect(after).toBeGreaterThan(before); // a distinct requester still lands
  });

  behaviorIt("write-token-enforced", async () => {
    const o = ownerAt(3);
    const payload = crypto.getRandomValues(new Uint8Array(ALIAS_PAYLOAD_SIZE));
    const err = await api
      .putAlias(o.aliasId, payload, randomWriteToken())
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    if (err instanceof ApiError) expect(err.kind).toBe("forbidden");
  });

  behaviorIt("alias-read-uniform-bad-id", async () => {
    // The hot read is existence-uniform even for a malformed id: a decoy, not a 400.
    const res = await fetch(`${baseUrl}/a/not-a-valid-id`);
    expect(res.status).toBe(200);
    expect((await res.arrayBuffer()).byteLength).toBe(ALIAS_PAYLOAD_SIZE);
  });

  behaviorIt("account-bad-id-rejected", async () => {
    // The non-uniform account endpoint does reject a malformed id.
    const res = await fetch(`${baseUrl}/acct/not-a-valid-id`);
    expect(res.status).toBe(400);
  });

  behaviorIt("alias-size-enforced", async () => {
    const res = await fetch(`${baseUrl}/a/${randomAliasId()}`, {
      method: "PUT",
      headers: {
        [HEADER_WRITE_TOKEN]: "t",
        "Content-Type": "application/octet-stream",
      },
      body: new Uint8Array(10), // not the fixed 4096
    });
    expect(res.status).toBe(400);
  });

  behaviorIt("account-blob-capped", async () => {
    const res = await fetch(`${baseUrl}/acct/${randomAliasId()}`, {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body: new Uint8Array((1 << 20) + 1), // one byte over the cap
    });
    expect(res.status).toBe(413);
  });

  behaviorIt("account-miss-is-404", async () => {
    expect(await api.getAccount(randomAliasId())).toBeNull();
  });

  behaviorIt("no-silent-faults", async () => {
    const mix = await driveMix(api, owners, { ops: 2000, concurrency: 50 });
    // The mix actually exercised the read-skewed shape (not just one op type), so
    // "no faults" is a statement about real, varied traffic.
    expect(mix.getReal).toBeGreaterThan(0);
    expect(mix.getDecoy).toBeGreaterThan(0);
    expect(mix.knock).toBeGreaterThan(0);
    expect(mix.accountGet).toBeGreaterThan(0);
    const m = await scrapeMetrics(metricsUrl);
    expect(m.sum("sti_errors_total")).toBe(0); // nothing hid behind a decoy/202
    expect(m.sum("sti_sensitive_overload_total")).toBe(0); // 50 << MaxInflight 256
  });

  behaviorIt("telemetry-existence-blind", async () => {
    const o = ownerAt(4);
    const base = (await scrapeMetrics(metricsUrl)).value(GET_2XX) ?? 0;
    await api.getAlias(o.aliasId); // a real hit
    expect((await scrapeMetrics(metricsUrl)).value(GET_2XX)).toBe(base + 1);
    await api.getAlias(randomAliasId()); // a decoy miss
    const afterMiss = await scrapeMetrics(metricsUrl);
    expect(afterMiss.value(GET_2XX)).toBe(base + 2); // same counter, same +1
    expect(afterMiss.names().some((n) => /hit|miss/i.test(n))).toBe(false);
  });

  behaviorIt("metrics-labels-are-templates", async () => {
    const s = await scrapeMetrics(metricsUrl);
    const idShaped = /[A-Za-z0-9_-]{43}/; // a 43-char opaque id would look like this
    const allowed = new Set([
      "/a/{id}",
      "/acct/{id}",
      "/notify",
      "/push/register",
      "/knock/{id}",
      "/healthz",
      "/",
      "other",
    ]);
    for (const series of s.series()) {
      expect(idShaped.test(series)).toBe(false); // no id anywhere in name{labels}
      const m = /endpoint="([^"]+)"/.exec(series);
      const ep = m?.[1];
      if (ep !== undefined) expect(allowed.has(ep)).toBe(true); // template, not a path
    }
  });

  behaviorIt("ip-rate-limit", async () => {
    // Its own instance at the DEFAULT budget (the shared one lifts the limit).
    await withInstance(
      { STI_IP_RATE_PER_SEC: "5", STI_IP_BURST: "20" },
      async (h) => {
        const statuses = await Promise.all(
          Array.from({ length: 60 }, () =>
            fetch(`${h.baseUrl}/acct/${randomAliasId()}`).then((r) => r.status),
          ),
        );
        expect(statuses.filter((s) => s === 429).length).toBeGreaterThan(0);
      },
    );
  });

  behaviorIt(
    ["nonsensitive-shed-503", "sensitive-overload-uniform"],
    async () => {
      // One inflight slot + a 1ms sensitive wait, so a concurrent flood forces both
      // shed paths. IP limit lifted so 503 comes from the cap, not the limiter.
      await withInstance(
        {
          STI_MAX_INFLIGHT: "1",
          STI_SENSITIVE_WAIT: "1ms",
          STI_IP_RATE_PER_SEC: "100000",
          STI_IP_BURST: "100000",
        },
        async (h, client, metrics) => {
          // Non-sensitive flood: with one inflight slot, excess sheds with 503.
          const puts = await Promise.all(
            Array.from({ length: 100 }, () =>
              fetch(`${h.baseUrl}/acct/${randomAliasId()}`, {
                method: "PUT",
                headers: { "Content-Type": "application/octet-stream" },
                body: new Uint8Array(64),
              }).then((r) => r.status),
            ),
          );
          expect(puts.filter((s) => s === 503).length).toBeGreaterThan(0);
          expect(
            (await scrapeMetrics(metrics)).sum("sti_shed_total"),
          ).toBeGreaterThan(0);

          // Sensitive reads under the same single-slot pressure must stay
          // 200/decoy (never 429/503) and must exercise the uniform overload
          // fallback. Fire concurrent rounds until the fallback counter moves, so
          // the assertion does not hinge on one round's scheduling.
          let overload = 0;
          const deadline = Date.now() + 5000;
          while (overload === 0 && Date.now() < deadline) {
            const reads = await Promise.allSettled(
              Array.from({ length: 100 }, () =>
                client.getAlias(randomAliasId()),
              ),
            );
            for (const r of reads) expect(r.status).toBe("fulfilled");
            overload = (await scrapeMetrics(metrics)).sum(
              "sti_sensitive_overload_total",
            );
          }
          expect(overload).toBeGreaterThan(0);
        },
      );
    },
  );

  behaviorIt("knock-ttl-expiry", async () => {
    // Short TTL + a fast janitor, so expiry is observable in seconds, not minutes.
    await withInstance(
      { STI_KNOCK_TTL: "100ms", STI_JANITOR_INTERVAL: "100ms" },
      async (_h, client, metrics) => {
        await client.knock(randomAliasId(), "ttl-req");
        let rows = (await scrapeMetrics(metrics)).gauge("sti_knock_rows");
        expect(rows).toBeGreaterThanOrEqual(1); // recorded
        const deadline = Date.now() + 5000;
        while (rows > 0 && Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 100));
          rows = (await scrapeMetrics(metrics)).gauge("sti_knock_rows");
        }
        expect(rows).toBe(0); // purged after expiry
      },
    );
  });

  behaviorIt("concurrent-alias-overwrite", async () => {
    const id = randomAliasId();
    const token = randomWriteToken();
    const key = await importAesKey(crypto.getRandomValues(new Uint8Array(32)));
    await api.putAlias(
      id,
      await sealToSize(key, utf8ToBytes("v0"), ALIAS_PAYLOAD_SIZE),
      token,
    ); // claim the alias
    const [pa, pb] = await Promise.all([
      sealToSize(key, utf8ToBytes("vA"), ALIAS_PAYLOAD_SIZE),
      sealToSize(key, utf8ToBytes("vB"), ALIAS_PAYLOAD_SIZE),
    ]);
    await Promise.all([
      api.putAlias(id, pa, token),
      api.putAlias(id, pb, token),
    ]);
    const final = bytesToUtf8(await openSized(key, await api.getAlias(id)));
    expect(["vA", "vB"]).toContain(final); // one whole write won, never torn
  });

  behaviorIt("alias-oversize-rejected", async () => {
    const res = await fetch(`${baseUrl}/a/${randomAliasId()}`, {
      method: "PUT",
      headers: {
        [HEADER_WRITE_TOKEN]: "t",
        "Content-Type": "application/octet-stream",
      },
      body: new Uint8Array(ALIAS_PAYLOAD_SIZE + 100), // over the fixed size
    });
    expect(res.status).toBe(400);
  });

  behaviorIt("no-leak-recovery", async () => {
    const before = await scrapeMetrics(metricsUrl);
    const goroutinesBefore = before.gauge("sti_goroutines");
    const janitorBefore = before.gauge("sti_janitor_last_run_seconds");
    await driveMix(api, owners, { ops: 3000, concurrency: 64 });
    // Settle: per-request goroutines exit, slots free, and the janitor ticks.
    let after = await scrapeMetrics(metricsUrl);
    const deadline = Date.now() + 6000;
    while (
      (after.gauge("sti_inflight_current") > 0 ||
        after.gauge("sti_goroutines") > goroutinesBefore + 30 ||
        after.gauge("sti_janitor_last_run_seconds") <= janitorBefore) &&
      Date.now() < deadline
    ) {
      await new Promise((r) => setTimeout(r, 200));
      after = await scrapeMetrics(metricsUrl);
    }
    expect(after.gauge("sti_inflight_current")).toBe(0); // no slot leaked
    expect(after.gauge("sti_goroutines")).toBeLessThanOrEqual(
      goroutinesBefore + 30,
    ); // no goroutine leak
    expect(after.gauge("sti_janitor_last_run_seconds")).toBeGreaterThan(
      janitorBefore,
    ); // the background loop kept ticking under load
  });

  behaviorIt("account-deletion-removes-blob", async () => {
    const master = crypto.getRandomValues(new Uint8Array(32));
    const accountId = await deriveAccountId(master);
    const key = await importAesKey(await deriveAccountKey(master));
    await api.putAccount(accountId, await seal(key, utf8ToBytes("blob")));
    expect(await api.getAccount(accountId)).not.toBeNull();
    await api.deleteAccount(accountId);
    expect(await api.getAccount(accountId)).toBeNull(); // gone after DELETE
  });

  behaviorIt("owner-knock-review-count", async () => {
    const o = ownerAt(5);
    await api.knock(o.aliasId, "review-a");
    await api.knock(o.aliasId, "review-b");
    const review = await api.knockReview(o.aliasId, o.writeToken);
    expect(review.count).toBeGreaterThanOrEqual(2); // two distinct requesters
  });

  behaviorIt("knock-review-token-gated", async () => {
    const o = ownerAt(6);
    const real = await fetch(`${baseUrl}/knock/${o.aliasId}`, {
      headers: { [HEADER_WRITE_TOKEN]: "wrong-token" },
    });
    const fake = await fetch(`${baseUrl}/knock/${randomAliasId()}`, {
      headers: { [HEADER_WRITE_TOKEN]: "wrong-token" },
    });
    expect(real.status).toBe(403); // wrong token is rejected
    expect(fake.status).toBe(403); // a nonexistent alias looks identical: no leak
    const ok = await api.knockReview(o.aliasId, o.writeToken);
    expect(typeof ok.count).toBe("number"); // the owner's token works
  });

  // MUST be last: it tears the instance down, so nothing can run after it.
  behaviorIt("teardown-clears-datastore", () => {
    const h = harness;
    if (h === undefined) throw new Error("no harness to tear down");
    const { dbPath, workDir } = h;
    h.stop();
    harness = undefined; // afterAll must not double-stop
    if (dbPath !== undefined) expect(existsSync(dbPath)).toBe(false);
    if (workDir !== undefined) expect(existsSync(workDir)).toBe(false);
  });
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Backend route-usage gate.
//
// Every route the Go server registers should be reachable from a client, or be
// deliberately server-only. A handler is always statically "reachable" (it is
// wired into the mux), so `go run .../deadcode` can never tell you a route went
// cold. This check can: it cross-references the routes the server registers
// against the paths the passport app and the admin console actually call, so a
// route whose last caller disappears stops the build until it is removed (the
// default) or consciously kept (the allowlist, with a reason).
//
// It also catches drift the other way: a frontend call to a path the server no
// longer serves, and an allowlist entry for a route that no longer exists.
//
// The allowlist (routes that are server-only or operator-only by design) lives
// in the .route-allowlist dotfile at the repo root, so a route can be allowlisted
// without editing this test.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Parse .route-allowlist: one "METHOD /template reason" per line, with # comments
// and blank lines ignored. Returns the kept lines verbatim (for the well-formed
// test) and the route -> reason map the gate uses.
function loadAllowlist() {
  const text = readFileSync(join(ROOT, ".route-allowlist"), "utf8");
  const lines = text
    .split("\n")
    .map((raw, idx) => ({ text: raw.trim(), lineNo: idx + 1 }))
    .filter((l) => l.text && !l.text.startsWith("#"));
  const map = new Map();
  for (const { text: line } of lines) {
    const [method, path, ...reason] = line.split(/\s+/);
    map.set(`${method} ${path}`, reason.join(" "));
  }
  return { lines, map };
}

const { lines: allowlistLines, map: ALLOWLIST } = loadAllowlist();

// --- Parse the server side ---------------------------------------------------

// contract.Path* constant -> value, so an "GET "+contract.PathAdminPing
// registration resolves to its real path.
function contractPaths() {
  const src = readFileSync(
    join(ROOT, "server/internal/contract/contract.go"),
    "utf8",
  );
  const map = new Map();
  for (const m of src.matchAll(/\b(Path\w+)\s*=\s*"([^"]+)"/g)) {
    map.set(m[1], m[2]);
  }
  return map;
}

// Every route registered on the public mux, as "METHOD /template". Handles both
// a literal ("GET /a/{id}") and a constant concat ("GET "+contract.PathAdminPing).
function registeredRoutes() {
  const consts = contractPaths();
  const files = ["server.go", "admin.go"].map((f) =>
    readFileSync(join(ROOT, "server/internal/server", f), "utf8"),
  );
  const routes = new Map(); // "METHOD /path" -> { method, path }
  const re =
    /s\.mux\.HandleFunc\(\s*"([A-Z]+)\s+([^"]*)"(?:\s*\+\s*contract\.(\w+))?/g;
  for (const src of files) {
    for (const m of src.matchAll(re)) {
      const method = m[1];
      let path = m[2];
      if (m[3]) {
        const v = consts.get(m[3]);
        assert.ok(v, `unknown contract constant in a route: ${m[3]}`);
        path += v;
      }
      routes.set(`${method} ${path}`, { method, path });
    }
  }
  return routes;
}

// The static lead of a route template, up to the first wildcard. "/a/{id}" ->
// "/a/", "/notify" -> "/notify", "/{$}" -> "/".
function staticPrefix(path) {
  const i = path.indexOf("{");
  return i === -1 ? path : path.slice(0, i);
}

// --- Parse the frontend side -------------------------------------------------

function walk(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

// All product source under passport/src, minus tests and stories (which mock the
// API rather than call it) and the contract module itself (the definition of
// PATHS, not a caller of it).
function frontendSource() {
  return walk(join(ROOT, "passport/src"))
    .filter(
      (p) =>
        /\.(ts|tsx)$/.test(p) &&
        !/\.test\.(ts|tsx)$/.test(p) &&
        !/\.stories\.(ts|tsx)$/.test(p) &&
        !p.endsWith(join("api", "contract.ts")),
    )
    .map((p) => readFileSync(p, "utf8"))
    .join("\n");
}

// The two ways the frontend names a backend route:
//  - PATHS.<key>, resolved to its value via the contract; counted only when a
//    real consumer references the key (so a path that is still DEFINED but no
//    longer USED reads as cold).
//  - a raw "/admin/<resource>" literal the admin console builds by hand (the
//    operator surface is not in PATHS). We key admin routes by their resource
//    segment so "/admin/vanity/{name}/takedown" matches the console's
//    `/admin/vanity/${name}/${action}`.
// The scan is over code AND comments; at worst a path named only in a comment
// reads as used, which misses a dead route rather than failing a live one.
function frontendUsage(src) {
  const contractTs = readFileSync(
    join(ROOT, "passport/src/api/contract.ts"),
    "utf8",
  );
  const block = /export const PATHS = \{([\s\S]*?)\} as const;/.exec(
    contractTs,
  );
  assert.ok(block, "could not find the PATHS object in contract.ts");
  const usedPathValues = new Set();
  for (const m of block[1].matchAll(/(\w+):\s*"([^"]+)"/g)) {
    const [, key, value] = m;
    if (new RegExp(`PATHS\\.${key}\\b`).test(src)) usedPathValues.add(value);
  }
  // Anchor "/admin/" to a URL boundary (an opening quote/backtick, or the `}`
  // closing a `${apiBase}` interpolation) so module specifiers like
  // "./ui/admin/adminRoute.ts" are not mistaken for a backend call.
  const adminResources = new Set();
  for (const m of src.matchAll(/["'`}]\/admin\/([a-z]+)/g)) {
    adminResources.add(m[1]);
  }
  return { usedPathValues, adminResources };
}

function isFrontendUsed({ path }, usage) {
  if (path.startsWith("/admin/")) {
    return usage.adminResources.has(path.split("/")[2]);
  }
  return usage.usedPathValues.has(staticPrefix(path));
}

// --- The gate ----------------------------------------------------------------

const routes = registeredRoutes();
const usage = frontendUsage(frontendSource());

test("the server registers the routes we expect to parse", () => {
  // A guard on the parser itself: if a refactor changes how routes register and
  // the regex stops matching, this catches the silent "0 routes, all green".
  assert.ok(routes.size >= 20, `parsed only ${routes.size} routes`);
  assert.ok(routes.has("GET /a/{id}"), "did not parse the alias read route");
  assert.ok(
    routes.has("GET /admin/ping"),
    "did not parse the constant-concat admin route",
  );
});

test("every registered route is called by a frontend or allowlisted", () => {
  const orphans = [];
  for (const [key, route] of routes) {
    if (isFrontendUsed(route, usage)) continue;
    if (ALLOWLIST.has(key)) continue;
    orphans.push(key);
  }
  assert.deepEqual(
    orphans,
    [],
    `these routes are registered but nothing calls them. Remove the route ` +
      `(and its handler + tests), or add it to .route-allowlist with a reason ` +
      `if it is server-only or operator-only by design:\n  ${orphans.join("\n  ")}`,
  );
});

test("every .route-allowlist entry is well-formed (METHOD /path reason)", () => {
  const malformed = allowlistLines
    .filter(({ text }) => {
      const [method, path, ...reason] = text.split(/\s+/);
      return (
        !/^[A-Z]+$/.test(method ?? "") ||
        !(path ?? "").startsWith("/") ||
        reason.join("").length === 0
      );
    })
    .map(({ text, lineNo }) => `line ${lineNo}: ${text}`);
  assert.deepEqual(
    malformed,
    [],
    `.route-allowlist entries must read "METHOD /template reason":\n  ${malformed.join("\n  ")}`,
  );
});

test("the gate detects a route that nothing calls (self-check)", () => {
  // Pin the detector: a route with no frontend caller and no allowlist entry is
  // exactly the orphan condition the main test asserts is empty. If this ever
  // reads "used", the gate has gone blind and the main test is a false green.
  const fake = { method: "GET", path: "/proof-unused/{id}" };
  assert.equal(isFrontendUsed(fake, usage), false);
  assert.equal(ALLOWLIST.has("GET /proof-unused/{id}"), false);
});

test("no allowlist entry is stale", () => {
  const stale = [...ALLOWLIST.keys()].filter((k) => !routes.has(k));
  assert.deepEqual(
    stale,
    [],
    `these routes are allowlisted but no longer registered; drop them from ` +
      `.route-allowlist:\n  ${stale.join("\n  ")}`,
  );
});

test("no allowlist entry is actually frontend-used", () => {
  // If a route is both allowlisted and called by a frontend, the allowlist entry
  // is dead weight (or a panel got wired and the entry should go).
  const redundant = [...ALLOWLIST.keys()].filter((k) => {
    const route = routes.get(k);
    return route && isFrontendUsed(route, usage);
  });
  assert.deepEqual(
    redundant,
    [],
    `these routes are now frontend-used; remove their .route-allowlist entries:\n  ${redundant.join("\n  ")}`,
  );
});

test("every frontend-referenced endpoint maps to a registered route", () => {
  const prefixes = new Set(
    [...routes.values()].map((r) => staticPrefix(r.path)),
  );
  const danglingPaths = [...usage.usedPathValues].filter(
    (v) => !prefixes.has(v),
  );
  const adminResources = new Set(
    [...routes.values()]
      .filter((r) => r.path.startsWith("/admin/"))
      .map((r) => r.path.split("/")[2]),
  );
  const danglingAdmin = [...usage.adminResources].filter(
    (r) => !adminResources.has(r),
  );
  assert.deepEqual(
    { danglingPaths, danglingAdmin },
    { danglingPaths: [], danglingAdmin: [] },
    "a frontend call targets a path the server no longer registers",
  );
});

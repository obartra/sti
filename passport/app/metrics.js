/* metrics, operational telemetry. ENGINEERING, INVISIBLE.
   It measures the SYSTEM, never the people. This is a faithful shim for the
   signed-off operational-metrics model; it is FIRST-PARTY and on-device, and is
   NOT wired to any network here (flush() is a disclosed stub).

   HARD RULES this module enforces (and the reasons):
     • RED/USE-style AGGREGATES only, request Rate / Errors / Duration and
       coarse system gauges. Counters + timings, never event rows.
     • NO user identifier of any kind. Nothing per-token, per-recipient, or
       per-alias. The notification recipient set is NEVER observed or counted.
     • Distinct counts use a HyperLogLog-style cardinality SKETCH, it stores
       registers, never the values it saw, so it can estimate "how many distinct"
       without being able to reproduce WHICH.
     • Event names come from a fixed LOW-CARDINALITY allowlist. High-cardinality
       labels (ids, handles, aliases, free text) are rejected, not stored.
     • A sanitizer strips URLs, #fragments, and known health-value keys BEFORE
       anything is aggregated, so a health value or a resolvable link can never
       ride along even by accident.
     • NO third-party analytics / crash SDK is loaded anywhere near a health
       surface. This module is the only telemetry, and it is first-party.
     • Short retention: raw inputs are reduced to aggregates immediately; nothing
       raw is retained.
   Exposed on window.Metrics. */
window.Metrics = (function () {
  "use strict";

  // Fixed low-cardinality allowlist. A name not on this list is dropped, the
  // namespace cannot be enumerated into high-cardinality labels.
  var EVENTS = {
    "screen.view": 1,      // a screen was shown (by coarse screen NAME only)
    "report.saved": 1,     // a result was recorded (no infection, no outcome)
    "alert.sent": 1,       // an anonymous heads-up batch committed (NO recipients)
    "knock.requested": 1,  // a knock action ran (NO alias, NO token)
    "share.opened": 1,     // the share sheet opened
    "wallet.added": 1,     // a pass was added
    "app.error": 1,        // an error occurred (no stack, no message text)
  };

  // Counters + timing reservoirs, aggregate-only. No identifiers, no rows.
  var counters = {};            // name -> integer count
  var timings = {};             // name -> { n, sum, max } (RED duration)

  // ── HyperLogLog-ish distinct sketch ──────────────────────────────────────
  // Stores only register maxima, never the inputs. Lets us answer "how many
  // distinct sessions touched X" without being able to recover any session id.
  function newSketch() { return new Uint8Array(64); }
  var sketches = {};            // name -> Uint8Array(64) registers
  function hash32(s) {
    var h = 2166136261 >>> 0;
    s = String(s);
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  function observeDistinct(name, value) {
    if (!EVENTS[name]) return;
    var reg = sketches[name] || (sketches[name] = newSketch());
    var h = hash32(value);
    var idx = h & 63;                       // 64 registers
    var rest = (h >>> 6) || 1;
    var lead = 1; while ((rest & 1) === 0 && lead < 26) { lead++; rest >>= 1; } // ρ(w)
    if (lead > reg[idx]) reg[idx] = lead;   // keep only the max, value is gone
  }
  function estimate(name) {
    var reg = sketches[name]; if (!reg) return 0;
    var m = reg.length, sum = 0, zeros = 0;
    for (var i = 0; i < m; i++) { sum += 1 / (1 << reg[i]); if (reg[i] === 0) zeros++; }
    var est = 0.709 * m * m / sum;          // bias-corrected estimate
    if (est <= 2.5 * m && zeros) est = m * Math.log(m / zeros); // small-range
    return Math.round(est);
  }

  // ── Sanitizer ─────────────────────────────────────────────────────────────
  // Strips anything that could carry identity, a resolvable link, or a health
  // value before it reaches an aggregate. Returns nothing useful for labels ·
  // by design, labels are not supported at all.
  var HEALTH_KEYS = /(status|badge|result|infection|hiv|herpes|hpv|syph|gc|ct|hepb|outcome|alias|handle|token|recipient|name|email|phone)/i;
  function sanitize(obj) {
    if (obj == null) return undefined;
    if (typeof obj === "string") {
      // drop URLs and #fragments entirely
      if (/https?:|sti\.care\/|#k=|\/a\/|\/u\//i.test(obj)) return undefined;
      return undefined; // free text is never aggregated as a label
    }
    return undefined;   // objects/values never become labels, aggregates only
  }

  // ── Public, aggregate-only API ──────────────────────────────────────────────
  function count(name) {
    if (!EVENTS[name]) return;             // reject high-cardinality / unknown
    counters[name] = (counters[name] || 0) + 1;
  }
  function timing(name, ms) {
    if (!EVENTS[name]) return;
    var t = timings[name] || (timings[name] = { n: 0, sum: 0, max: 0 });
    ms = +ms || 0; t.n++; t.sum += ms; if (ms > t.max) t.max = ms;
  }
  // distinct(name, sessionScopedValue), value is hashed into the sketch and
  // immediately discarded. Callers pass a per-SESSION nonce, never a user id.
  function distinct(name, value) { observeDistinct(name, value); }

  // A per-session nonce (NOT a user id): random, never persisted, rotates each
  // load. Used only to feed distinct sketches so they estimate sessions, not
  // people.
  var SESSION = "s_" + Math.random().toString(36).slice(2, 10);

  // snapshot() → the only thing that would ever leave the device: pure
  // aggregates. No labels, no ids, no recipient sets. flush() is a disclosed
  // first-party stub, it does NOT send anywhere in this prototype.
  function snapshot() {
    var distincts = {}; for (var k in sketches) distincts[k] = estimate(k);
    return { counters: Object.assign({}, counters), timings: JSON.parse(JSON.stringify(timings)), distinct: distincts };
  }
  function flush() { /* first-party + disclosed; intentionally a no-op here */ return snapshot(); }

  return {
    count: count, timing: timing, distinct: distinct,
    sanitize: sanitize, snapshot: snapshot, flush: flush,
    SESSION: SESSION, _events: EVENTS,
  };
})();

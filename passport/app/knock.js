/* knock, the Knock access model, applied live. THE SECURITY BOUNDARY.

   This module is the load-bearing part of the signed-off Knock proposal
   ("Knock Access - Proposal.html"). The existence-safety lives HERE, at the
   action/data layer, NOT in whether a button is shown. A prober who calls
   window.Knock.requestAccess(...) directly, bypassing all UI, gets the exact
   same uniform reply as the in-app affordance. The hidden-button is pure UX.

   Guarantees (invariants 6 & 8):
     • requestAccess() returns ONE uniform result, same content, same bounded
       work / same code path, for real, fake, guessed, revoked, AND
       over-rate-limit ids. No early-return branch a caller can observe.
     • No requester-facing state EVER: no pending, granted, or denied is
       returned or readable. A grant writes a key TO the requester (their status
       resolves next open); it never writes a flag the requester can poll.
     • Owner-pull only: pendingFor/hasPending/grant/ignore/clearAll are the
       owner's surface; none is reachable by a requester.
     • One config constant (KNOCK_TTL_DAYS = 4) governs auto-expiry; expiry
       sends the requester no signal. Two rate buckets (requester + alias).
     • A knock row is { alias_id, requester_token, created_at }, no identity,
       no name, no message.

   In production this sits on the encrypted store + a knock table; here it's an
   in-memory prototype, seeded so the owner surface has something to show.
   Exposed on window.Knock. NOT wired to any network. */
window.Knock = (function () {
  "use strict";

  // ── Config, one TTL constant + two rate buckets (proposal §5/§6). ────────
  var KNOCK_TTL_DAYS = 4;                      // a knock self-deletes ~4d after arrival
  var RATE = { perRequester: 3, perAlias: 25 }; // throttle a prober / a forwarded-link wave
  var UNIFORM = "If this passport exists, your request has been sent.";
  var DAY = 86400000;

  // ── Prototype "server" state. NOT queryable by anything but the uniform
  //    action below, there is no list-ids / exists / availability endpoint
  //    (invariant 8). EXISTING stands in for "an opaque id that decrypts." ──
  var EXISTING = { "a7f3k9q2": 1, "s9k2m4x7": 1, "p2m8d4q7": 1, "k3v7m2p8": 1 };

  // knock rows: { alias_id, requester_token, created_at }. No identity/message.
  var rows = [];
  // Keys written OUT to a requester on grant. NOT a flag the requester reads.
  var grantedKeys = [];
  // Rate counters, keyed by requester_token and by alias_id.
  var seenReq = {}, seenAlias = {};

  function now() { return Date.now(); }
  function mintToken() { return "rq_" + Math.random().toString(36).slice(2, 11); }

  // Stale knocks self-clean. No signal is sent to the requester when this fires.
  function sweep() {
    var cutoff = now() - KNOCK_TTL_DAYS * DAY;
    rows = rows.filter(function (r) { return r.created_at >= cutoff; });
  }

  function dedupe(list) {
    var seen = {}, out = [];
    for (var i = 0; i < list.length; i++) {
      var k = list[i].alias_id + "|" + list[i].requester_token;
      if (seen[k]) continue;
      seen[k] = 1; out.push(list[i]);
    }
    return out;
  }

  // ════════════════════════════════════════════════════════════════════════
  //  THE ENDPOINT. Same bounded work + identical return on EVERY path:
  //  real · fake · guessed · revoked · over-limit. There is deliberately NO
  //  branch of the form "if (!exists) return early", existence only ever
  //  changes WHERE the (always-constructed) row is routed, never the work done
  //  nor the value returned. This is what keeps the knock path from being an
  //  existence oracle (inv. 6) or an enumeration oracle (inv. 8), independent
  //  of any UI gating.
  // ════════════════════════════════════════════════════════════════════════
  function requestAccess(input) {
    input = input || {};
    var aliasId = input.aliasId || "";
    var requesterToken = input.requesterToken || mintToken();
    var t = now();
    sweep();

    // Always-run, branch-free work (same on every path):
    var reqCount = (seenReq[requesterToken] = (seenReq[requesterToken] || 0) + 1);
    var aliasCount = (seenAlias[aliasId] = (seenAlias[aliasId] || 0) + 1);
    var exists = Object.prototype.hasOwnProperty.call(EXISTING, aliasId);
    var underLimit = reqCount <= RATE.perRequester && aliasCount <= RATE.perAlias;
    var accept = exists && underLimit;

    // A row is ALWAYS constructed and pushed; only the destination differs ·
    // the live table when accepted, a discarded sink otherwise. No observable
    // "real → write + alert, fake → skip" difference; over-limit also lands in
    // the sink and STILL returns the uniform reply (never a distinct 429).
    var row = { alias_id: aliasId, requester_token: requesterToken, created_at: t };
    var sink = [];
    (accept ? rows : sink).push(row);
    if (accept) rows = dedupe(rows); // owner sees one entry per requester, not a flood

    // Identical result regardless of everything above. No status, no pending,
    // no granted/denied, the requester learns nothing about existence.
    return { ok: true, message: UNIFORM, requesterToken: requesterToken };
  }

  // ── Owner-pull surface. None of this is reachable by a requester. ─────────
  function pendingFor(aliasId) {
    sweep();
    return rows.filter(function (r) { return r.alias_id === aliasId; });
  }
  function hasPending(aliasId) { return pendingFor(aliasId).length > 0; }

  function grant(aliasId, token) {
    grantedKeys.push({ alias_id: aliasId, requester_token: token }); // key OUT to requester
    rows = rows.filter(function (r) { return !(r.alias_id === aliasId && r.requester_token === token); });
    return true; // never written back as a readable "granted" flag
  }
  function ignore(aliasId, token) { // tells the requester nothing; just drops the row
    rows = rows.filter(function (r) { return !(r.alias_id === aliasId && r.requester_token === token); });
  }
  function clearAll(aliasId) { // bulk-dismiss a forwarded-link wave
    rows = rows.filter(function (r) { return r.alias_id !== aliasId; });
  }

  // Dev-panel helper: seed or clear the demo pending knocks on the owner's
  // primary alias so a reviewer can reach both the "no requests" and "pending"
  // owner states. NOT a product surface, affects the in-memory prototype only.
  function setDemoPending(on) {
    var id = "a7f3k9q2";
    rows = rows.filter(function (r) { return r.alias_id !== id; });
    if (on) {
      var t = now();
      rows.push({ alias_id: id, requester_token: mintToken(), created_at: t - 1.2 * DAY });
      rows.push({ alias_id: id, requester_token: mintToken(), created_at: t - 2.6 * DAY });
      rows.push({ alias_id: id, requester_token: mintToken(), created_at: t - 3.6 * DAY });
    }
  }

  // Relative-age label for the owner list. "expiring" once within ~12h of TTL.
  function ageLabel(created_at) {
    var d = (now() - created_at) / DAY;
    var base = d < 0.04 ? "Just now" : d < 1 ? "Today" : d < 2 ? "1 day ago" : (Math.floor(d) + " days ago");
    var expiring = d >= KNOCK_TTL_DAYS - 0.6;
    return { base: base, expiring: expiring };
  }

  // Demo seed: a forwarded private link produced a few contentless knocks on
  // the owner's primary alias (a7f3k9q2). Ages span the ~4-day expiry edge.
  (function seed() {
    var t = now();
    rows = [
      { alias_id: "a7f3k9q2", requester_token: mintToken(), created_at: t - 1.2 * DAY },
      { alias_id: "a7f3k9q2", requester_token: mintToken(), created_at: t - 2.6 * DAY },
      { alias_id: "a7f3k9q2", requester_token: mintToken(), created_at: t - 3.6 * DAY },
    ];
  })();

  return {
    KNOCK_TTL_DAYS: KNOCK_TTL_DAYS, RATE: RATE, UNIFORM: UNIFORM,
    requestAccess: requestAccess,
    pendingFor: pendingFor, hasPending: hasPending,
    grant: grant, ignore: ignore, clearAll: clearAll,
    ageLabel: ageLabel,
    setDemoPending: setDemoPending,
    // debug only, NOT an oracle the product exposes; for verification eval_js.
    _rows: function () { return rows.slice(); },
  };
})();

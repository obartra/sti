/* LinkupStore, the single on-device home for the pairwise linkups structure.

   This is NOT a new structure. It lifts the linkups list Connect already kept
   (formerly local React state) into one module so a write made anywhere, a
   scan-to-link confirm OR a Linkup handshake, is the SAME edge and is seen by
   every surface that reads it: Connect's recent list and the Partner-alert
   (draft to lock) recipient list.

   CANONICAL ROW SHAPE, contentless on purpose:

       { alias_ref, pairwise_notify_token, ts }

     • alias_ref            on-device pairwise ALIAS reference (a handle/alias,
                            never a real name, invariant 9). No name field exists.
     • pairwise_notify_token an opaque per-pair token the notify edge rides.
     • ts                   epoch ms of the encounter.

   The row stores NO status of the other person, no place, no detail. Two things
   live here, kept distinct so a repeat logs without re-linking:

     • binds   the set of aliases you are LINKED with (the bind, made once, like
               scan-to-link).
     • rows    every ENCOUNTER, one row per time together, inside the notify
               window. A repeat appends a row but never a second bind.

   Rows self-prune at the 90-day notify window, so the edge a positive could
   ever touch stays recent and small. Exposed on window.LinkupStore.            */
(function () {
  "use strict";

  // The mock's fixed "today", matched to copy.js TODAY (10 Jun 2026), so the
  // relative labels and the prune window are stable across reloads and never
  // drift with the real wall clock.
  const NOW = Date.UTC(2026, 5, 10);
  // The owner's last clear test, matched to copy.js LAST_TESTED (7 Jun 2026).
  // The Partner-alert flow buckets recipients around this date.
  const LAST_TEST = Date.UTC(2026, 5, 7);
  const DAY = 86400000;
  const WINDOW_DAYS = 90;

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dayNum = (ts) => { const d = new Date(ts); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / DAY; };

  // Relative time label derived purely from ts (never a stored "place"/detail).
  function relLabel(ts) {
    const diff = dayNum(NOW) - dayNum(ts);
    if (diff <= 0) return "Today";
    if (diff === 1) return "Yesterday";
    const d = new Date(ts);
    return d.getUTCDate() + " " + MONTHS[d.getUTCMonth()];
  }

  // Opaque pairwise notify token. Never derived from anything identifying.
  function mkToken() {
    return "nt_" + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
  }

  // ── Seed, the linkups already on this device. The union of what Connect's
  // recent list and the Partner-alert flow used to hardcode separately, now one
  // source. Each is a real canonical row; the display handle is the alias_ref.
  const SEED = [
    ["sam",   "2026-06-09"], ["leo",   "2026-06-08"], ["ari",   "2026-06-08"],
    ["noa.v", "2026-06-07"], ["marco", "2026-06-07"], ["kai_",  "2026-06-04"],
    ["alexj", "2026-05-29"], ["jules", "2026-05-26"], ["theo",  "2026-05-21"],
    ["max.b", "2026-05-18"], ["rio",   "2026-05-12"], ["dann",  "2026-05-08"],
    ["sasha", "2026-05-02"], ["kit",   "2026-04-27"], ["nico",  "2026-04-22"],
    ["ben10", "2026-04-15"], ["ozzy",  "2026-04-09"], ["finn",  "2026-04-02"],
    ["remy",  "2026-03-28"], ["cass",  "2026-03-22"], ["jay",   "2026-03-18"],
    ["mika",  "2026-03-14"], ["drew",  "2026-03-12"],
  ];

  let rows = SEED.map(([alias_ref, iso]) => ({
    alias_ref,
    pairwise_notify_token: mkToken(),
    ts: Date.parse(iso + "T12:00:00Z"),
  }));
  const binds = new Set(rows.map((r) => r.alias_ref));

  // ── Subscription plumbing (for React.useSyncExternalStore). getSnapshot must
  // return a STABLE reference between mutations, so we cache it and only rebuild
  // on a real change.
  const listeners = new Set();
  let snapshot = freshSnapshot();
  function freshSnapshot() { prune(); return rows.slice(); }
  function emit() { snapshot = rows.slice(); listeners.forEach((fn) => fn()); }
  function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  function getSnapshot() { return snapshot; }

  // Self-prune anything past the notify window. The edge stays recent and small.
  function prune() {
    const cutoff = dayNum(NOW) - WINDOW_DAYS;
    const next = rows.filter((r) => dayNum(r.ts) >= cutoff);
    if (next.length !== rows.length) rows = next;
  }

  // ── The ONE write path. A Linkup handshake or a scan-to-link confirm both
  // call this. It is only ever reached AFTER a mutual gesture (the callers gate
  // it). There is no proximity / timer / one-sided path into this function.
  //   • binds the two aliases once (the link), if not already linked
  //   • ALWAYS appends one canonical encounter row (the log)
  // Returns { alreadyLinked } so the caller can pick "linked" vs "linked again".
  function log(alias_ref) {
    const alreadyLinked = binds.has(alias_ref);
    if (!alreadyLinked) binds.add(alias_ref);            // the bind (once)
    rows = [{ alias_ref, pairwise_notify_token: mkToken(), ts: NOW }, ...rows]; // the encounter (every time)
    prune();
    emit();
    return { alreadyLinked };
  }

  function isLinked(alias_ref) { return binds.has(alias_ref); }

  // Remove a linkup entirely (all its rows + the bind). Used by Connect's
  // delete action; keeps the user in control of their own log.
  function remove(alias_ref) {
    rows = rows.filter((r) => r.alias_ref !== alias_ref);
    binds.delete(alias_ref);
    emit();
  }

  // ── Read helpers ──────────────────────────────────────────────────────────
  // Most-recent encounter per alias, newest first, for the Connect list. The
  // underlying multi-row log is untouched; this only de-dupes the DISPLAY.
  function recent() {
    prune();
    const seen = new Set();
    const out = [];
    rows.slice().sort((a, b) => b.ts - a.ts).forEach((r) => {
      if (seen.has(r.alias_ref)) return;
      seen.add(r.alias_ref);
      out.push({ handle: r.alias_ref, when: relLabel(r.ts), ts: r.ts });
    });
    return out;
  }
  // Recipients for the Partner-alert flow, split around the last clear test.
  // De-duped to one entry per alias (you alert a person, not each encounter).
  function buckets() {
    const seen = new Set();
    const sorted = rows.slice().sort((a, b) => b.ts - a.ts);
    const since = [], earlier = [];
    sorted.forEach((r) => {
      if (seen.has(r.alias_ref)) return;
      seen.add(r.alias_ref);
      const item = { handle: r.alias_ref, when: relLabel(r.ts), ts: r.ts };
      (r.ts >= LAST_TEST ? since : earlier).push(item);
    });
    return { since, earlier };
  }

  // React hook: re-renders a subscriber on any write.
  function useLinkups() {
    return React.useSyncExternalStore(subscribe, getSnapshot);
  }

  window.LinkupStore = {
    log, isLinked, remove,
    recent, buckets, useLinkups,
    relLabel, NOW, LAST_TEST,
  };
})();

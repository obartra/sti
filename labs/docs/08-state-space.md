# sti.care: State Space

*The complete enumeration of every configurable dimension, the values it can take, and how those
combine into what a viewer or the owner actually sees. This is the source of truth for "what
states exist," which the Tweaks/dev panel should mirror (it currently doesn't; see the gap list
at the end). Read alongside `03-design.md` (the how) and `02-decisions.md` (the what).*

The point of this doc: the badge is **computed**, not set. Most surprising or leaky behavior
lives in *combinations* of dimensions, not any single one. Enumerating the axes makes the
combinations visible.

---

## A. The inputs that COMPUTE the badge (owner sets these; the badge is derived)

The viewer-facing badge is blue **only if all three hold**, else gray. None of these is a direct
"set my badge" control. That's the key correction the dev panel needs.

### A1. Testing recency & scope
- `tested_never`: no result ever entered. **Always gray.** (Earned from a real result, never
  inferred: "even a virgin can have HIV.")
- `tested_in_window`: **standard core panel (HIV, syphilis, gonorrhea, chlamydia)** result ≤ 90
  days old, **with every exposed site covered** (per-site "tested clear OR not exposed"; see
  below).
- `tested_stale`: last qualifying panel > 90 days old.
- `tested_incomplete`: tested, but the core panel or an exposed site is missing → does **not**
  qualify for blue (falls to gray, like stale). This is what closes the "I got a urine-only test"
  / "my center skipped syphilis" gap.

**Site sub-logic (on-device, never displayed):** for gonorrhea/chlamydia, each exposed site
(pharyngeal/rectal/urogenital) must be "tested clear OR not exposed." Not-exposed satisfies the
requirement without forcing a swab. The per-site detail produces the badge but is **never** a
viewer-facing fact (it would leak behavior: pharyngeal⇒oral, rectal⇒receptive anal).

### A2. Clearance (current infection state)
- `clear`: no current active non-HIV STI. The only acceptable positive is **prior-treated
  syphilis serology** (serofast), which does not break clear.
- `active_infection`: a current active non-HIV STI (untreated bacterial; detectable HIV). → gray
  (and typically auto-paused; see C2).
- **Chronic diagnoses (HSV, HPV) do NOT live on this axis at all.** They never gray, never label,
  never appear as an attribute. They're education-only (the badge is *current state, not
  diagnosis history*). A *transient* HSV outbreak is handled by **pause** (C), not by this axis.
  Syphilis serofast keeps `clear`; a reinfection (rising titer) moves to `active_infection`.

### A3. HIV-protection route (at least one required for blue)
- `prep`: on PrEP. Surfaces as the umbrella "On HIV prevention."
- `undetectable`: HIV-positive, undetectable. Surfaces as the **same** umbrella, never
  distinguishable from PrEP. "Undetectable" is never viewer-visible.
- `condoms_always_public`: the "condoms always" condom-preference value, **shown publicly**.
  This is the condom route.
- `none`: no qualifying route. → gray.

**On-device PrEP-coverage reliability (never viewer-facing, never badge-affecting).** Separate from
the `prep` route flag, the app holds an on-device sense of PrEP-coverage reliability (reliably
covered vs possible recent adherence gaps), used **only** to compose the PEP-urgency card after a
possible exposure (07 §A3, the suppress / soft / show branch). It never ranks the user, never
changes the badge (on-PrEP qualifies full stop, per Decisions' rejection of adherence-gating), and
is never shown to a viewer. Listed here so the enumeration is genuinely complete.

**Blue = (A1 `tested_in_window`) AND (A2 `clear`, with detectable HIV a hard blocker regardless of
route) AND (A3 ≠ `none`). Everything else = gray.**

---

## B. The attributes (owner sets; DISPLAYED independently, gated by authorization not color)

These show on blue AND gray, to authorized viewers only. They never change the badge color
(except where a value is also an A3 route, below).

### B1. HIV-prevention umbrella (the route headline, not an optional pill)
- When PrEP or undetectable is the route that earns blue, "On HIV prevention" is stated **once, in
  the blue headline**, and is **not independently hideable**. It states the route that earned blue
  (Decisions; Design §Displayed labels). You cannot be blue-via-PrEP/U=U and surface no route.
- There is no separate redundant umbrella pill to toggle: by the precedence rule, whenever PrEP/U=U
  is present it takes the headline (the umbrella wins over a condoms-always headline), so the
  umbrella appears exactly once, as that headline. (It stays identical for PrEP and undetectable,
  the camouflage invariant.)
- A user who wants blue *without* surfacing "On HIV prevention" must qualify via the public
  condoms-always route instead; the route you display is the route you earned.

### B2. Condom preference (3-state + off): DECOUPLED from badge computation
- `off`: not shown.
- `raw`: displayed "No condoms."
- `either`: displayed "Condoms optional."
- `always`: "condoms always." **When shown publicly, this value ALSO serves as the A3 condom
  route** (the one coupling). The other values never affect the badge.

All values are displayable so "always" isn't a lone tell.

### B3. Other flat attributes (optional, owner-set)
- `uses_condoms` (boolean), `on_doxy_pep` (boolean). Plain pills, never summed, never ranked.

---

## C. Pause (owner-controlled; only ever forces gray)

Pause is not a separate visible state; it sets the badge to gray, rendered identically to every
other gray. The owner chooses *whether* to pause.

### C1. Manual pause
- `off` / `on`. Manual "hide my status." Renders as ordinary gray to viewers; owner sees a
  private banner.

### C2. Auto-pause
- `off` / `on`. Computed on-device from a logged positive's clearance window. Same gray render.
  Extend yes, shorten-below-guideline no. Owner may privately see the computed un-pause timing;
  viewer never does.

*(C1 and C2 are independent booleans in state; either being true → viewer badge = gray.)*

---

## D. Sharing / visibility mode (per ALIAS, not global)

Two modes as of June 27, 2026 (revised from three: the intermediate Gated mode is removed; see doc
16). Each alias is one of **two modes**:

### D1. Private link (opaque + live): DEFAULT
- **Reach:** opaque id in URL (`/a/a7f3k9q2`); **live key in URL fragment** (`#k=…`).
- **Access:** immediate. Anyone who holds the keyed URL sees the card. No knock step.
- Cold/anonymous/guessed viewer → **uniform gray-nothing = nonexistent** (existence-hidden).
- **Identity default:** pseudonym derived from the alias id (`pseudonymFor(id)`), stable per
  alias, unlinkable across the owner's other links.
- No server directory entry.

### D2. Public link (handle + /u/ + knock)
- **Reach:** human handle registered in the server's `vanity_name` table; findable at
  `sti.care/u/{handle}`.
- **Access:** request. Anyone who visits the handle can **knock** (see E); the owner approves
  each viewer via the blind grant. No viewer sees the card without an explicit grant.
- Existence is **disclosed**: a `GET /u/{handle}` returning `200` reveals the handle is registered.
  This is the opted-into cost of being findable, disclosed at registration (doc 17).
- **Cap: 5 active public links per account.** The handle is claimed either at account creation
  (the optional username at sign-up, doc 32) or later from the Findable section in Settings, never
  from the share sheet.
- Scrapeable/watchable over time (mitigated, never fully solved).

*(Two modes. D1 is the default. D2 requires explicit opt-in with consent disclosure. `vanity + live`,
the one config that would put a readable status on the server, remains permanently off the menu.)*

---

## E. Knock states (only meaningful for a PRIVATE alias + a link-holder)

### E1. Requester side
- `not_knocked` → sees gated state with a knock affordance (only because they hold the link).
- `knocked` → sees the uniform "if this passport exists, your request was sent", **identical for
  real / fake / guessed ids.** No pending/granted/denied signal ever after.
- (granted) → status silently resolves to a badge next look.
- (not granted / nonexistent) → stays gray-nothing forever. Indistinguishable from each other.

### E2. Owner side
- `none` / `pending(n)`: a quiet persistent indicator on the alias (no per-knock push/buzz).
- Per-knock action: grant / ignore. Never auto-grant. Knocks auto-expire ~4 days; "clear all"
  bulk-dismiss. Contentless, rate-limited per requester/id.

---

## F. Wallet / shareable artifact (per alias, gated by D)

### F1. Format
- `none`: no pass.
- `qr_carrier`: ANY alias (public or private). Pass face shows **no status**: QR + handle +
  avatar + logo. Resolution gates downstream.
- `live`: **PUBLIC aliases only.** Face shows blue/gray, auto-updates. Enabling on a private
  alias is impossible (gated behind make-public confirm).

### F2. Live freshness (Live format only)
- `fresh` (read ≤ 24h) → may show blue.
- `stale` (> 24h / unreachable) → **fails closed to gray**, identical to any other gray. Not a
  distinct state; no "couldn't refresh" message.

### F3. Public-profile share
- Default is the **resolving link/QR** (tap = current), never a baked-in status image. A status
  image may exist only as a labelled "snapshot, scan for current," never default.

---

## G. Identity (per alias)

- `handle` and `avatar`: the card's displayed face. By default both derive deterministically from
  the alias id; an owner can override them per alias, and only that override is stored in the
  encrypted payload. **No real name anywhere** (no field exists).
- `opaque_id`: the URL address; random, meaningless, the only server-visible id.
- Per-alias default face: the deterministic id-derived pseudonym and avatar (`pseudonymFor(id)`,
  `avatarFor(id)`; see §D1). Because the id is random per alias, two of an owner's aliases share no
  default face, so the default is already unlinkable across links with no separate anti-relink step
  and no reuse warning. Showing the account's main identity instead is an explicit per-alias opt-in.

---

## H. Notification / partner-notify (transient flow state, not a profile setting)

- `draft` (~30 min): editable, deletable; user can add/correct/remove or delete the whole
  report.
- `locked`: historical, immutable; post-lock the app shows the user NOTHING (no timing/delivery/
  count).
- Content always anonymous/contentless. Server triggers (contentless wake); client composes
  (all conditional rendering on-device).

---

## The canonical viewer outcomes (what all of the above collapses to)

For any viewer looking at any alias, the observable result is exactly one of:

1. **Blue card** + whatever authorized attributes the owner shows (umbrella, condom pref, flat
   attributes).
2. **Gray card** + whatever authorized attributes the owner shows. (Gray = overdue / never-tested
   / paused / mid-treatment / HIV-detectable / no-route: all identical. One flat bucket.)
3. **Uniform gray-nothing** = nonexistent (private + unauthorized + not a link-holder, or a
   guessed id). No identity, no button.
4. **(Link-holder only) gated + knock affordance**: a private alias whose link they hold but
   aren't authorized for.

There is no fifth observable state. Everything in A-H resolves into one of these four.

---

## Gap list: where the current dev (Tweaks) panel is wrong or incomplete

The panel was a dev affordance for screenshotting states; it has drifted from the model. To make
it a faithful window into the state space, it should:

1. **Stop exposing `badge` as a direct blue/gray toggle.** Replace with the three *computing*
   inputs (A1 testing recency incl. `never`, A2 clearance, A3 route) so the badge is *derived* and
   you can see what produces gray. The current direct toggle hides the logic and lets you set
   impossible combos (e.g. blue + never-tested).
2. **Expose the A3 route explicitly** (prep / undetectable / condoms-always-public / none) and
   show the condom-route → blue coupling, rather than condoms and badge being independent.
3. **Fix the sharing dimension (D).** Current options are `public` / `link` labelled
   "Everyone" / "Request only", stale. Should be **private link / public link** (two modes, not
   three; "Request only" is wrong for private links which give immediate access). 
4. **Distinguish manual pause (C1) from auto-pause (C2)**: both exist in state (`paused`,
   `autoPaused`) but the panel shows one toggle.
5. **Add the never-tested state**: currently unreachable from the panel, but it's the
   always-gray case that matters most for "even a virgin can have HIV."
6. **Add wallet format (F1) + Live freshness (F2)** so the fail-closed-to-gray state is visible.
7. **Add knock states (E)** once the Knock pass lands.
8. **Remove the `partnerReach: "handles"` default**: it's a Post-MVP stub sitting in live
   defaults.

*(Items 6-7 depend on the wallet-apply and Knock passes; 1-5 and 8 are current drift. All of
these are folded into `prompt-4-finish.md` item 6, which aligns the dev panel to this doc.)*

## Note: the dev panel allows contradictory combinations (acceptable, but don't mistake for valid states)

The Tweaks/dev panel exposes dimensions independently, so it permits combinations that are NOT
reachable product states: e.g. Live-freshness set while pass format is QR-carrier (freshness only
applies to Live), knock states set while sharing is public (knock only exists for private),
"gated view seen by" while public. This is acceptable for a *dev testing tool* (over-constraining
it would make some states hard to reach in isolation), but a reviewer must not read a contradictory
combo as a real product state. The genuine interdependencies, for reference: **Live freshness ⇒
format=Live ⇒ alias=public**; **knock states ⇒ sharing=private**; **gated-view-seen-by ⇒
private**; **badge is derived from the three status inputs, never set directly**. The four
canonical viewer outcomes (blue / gray / gray-nothing / link-holder-gated-knock) remain the only
*observable* results; the panel's job is to reach those, not to model validity.

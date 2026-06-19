import { Matrix } from "../../lib/qr.tsx";
import { Medallion, blueHeadline, tagsFor } from "../badge-card.tsx";
import type { BadgeState, ProtectionLabel, Route } from "../badge-card.tsx";

/* Wallet, Apple Wallet, Google Wallet & a standalone shareable card for the
   passport. Faithful port of comps-reference/app/wallet.jsx, implementing the
   signed-off Pass 3.5 model:

     • FORMAT GATED BY PRIVACY MODE.
       - "qr"  , a LINK CARRIER. The face shows NO status: just QR + handle +
                  avatar + sti.care logo. Works for ANY alias (public OR
                  private). Resolution downstream does all the gating.
       - "live", PUBLIC aliases ONLY. The face shows the two-state badge
                  (blue/gray) and auto-updates, FAILING CLOSED to gray.
       Live cannot be enabled on a private alias: the option is disabled +
       explained, and turning it on routes through an explicit make-public
       confirmation (which flips this alias public before Live can switch on).

     • FAIL CLOSED TO GRAY. Blue is valid ONLY on a fresh confirmed read inside
       WALLET_FRESH_HOURS. Older / unreachable / can't-refresh → ordinary GRAY,
       rendered by the SAME pass with the SAME props as a genuinely-gray owner.
       Staleness is not a distinct state and there is NO "couldn't refresh"
       message anywhere, stale is byte-identical to every other gray.

     • Every pass inherits the badge rules: two visible states, handle + avatar
       never a real name, the sti.care logo, boolean precision (no dates, no
       freshness, no streak, no stamp, no count).

   The QR/URL encode an ALIAS, never a handle, never an account id:
     public / Live   → /a/{id}#k={key}
     private carrier → /a/{id}   (no key; the holder's contacts already have it) */

// Copy reproduced verbatim from the inline strings in wallet.jsx (there is no
// dedicated wallet object in copy.js; every string lives in the source).
export const COPY = {
  scanToOpen: "Scan to open",
  passport: "PASSPORT",
  sticare: "sti.care",
  healthPassport: "Health passport",
  snapshot: "Snapshot",
  status: "Status",
  shareNotLive: "A still image, not live. Scan for the current status.",
  shareOpenLink: "Scan or open the link to view this passport.",
  addTo: "Add to",
  appleWallet: "Apple Wallet",
  googleWallet: "Google Wallet",
  inYourWallet: (name: string) => `In your ${name}`,
  keepsCurrent: "Keeps itself current",
  remove: "Remove",
  open: "Open",
  confirmTitle: (handle: string) => `Make @${handle} public to go live?`,
  confirmBody:
    "A live pass puts this alias’s key in its own link, so anyone who has the pass can see your status. That’s what makes it public.",
  confirmPoints: [
    "Anyone with the pass or link sees your blue/gray status, and it stays current.",
    "It still never shows what you tested for, or any dates.",
    "Switch this alias back to private anytime, the live pass falls to gray.",
  ],
  keepPrivate: "Keep private",
  makePublicGoLive: "Make public & go live",
  screenTitle: "Add to your wallet",
  screenSub:
    "Keep your passport a swipe away. Pick how the pass works, a quiet link you can carry anywhere, or a live status that updates itself.",
  qrPassTitle: "QR pass",
  qrPassSub:
    "Carries a link. Shows your handle and a code, no status on the pass itself.",
  livePassTitle: "Live status pass",
  livePassSubPublic:
    "Shows your current status on the pass, and keeps it up to date.",
  livePassSubPrivate: "Needs a public alias.",
  liveNeedsPublic:
    "A live pass shows your status to anyone who has it, so it only works on a public alias.",
  makeAliasPublic: "Make this alias public…",
  orShareCard: "Or share a card",
  copyLink: "Copy link",
  saveCardImage: "Save card image",
  safeOnLock: "Safe on a lock screen",
  trustLive: [
    "The pass shows a status and a code, no test names, no dates.",
    "Blue only ever means a fresh, current read. If it can’t refresh, it quietly shows gray, never an old status.",
    "Lose your phone? Make the alias private from Privacy & sharing and the live pass falls to gray.",
  ],
  trustQr: [
    "The pass shows a code and your handle, no status, no test names, no dates.",
    "What a scanner sees is decided when they open the link, never by the pass itself.",
    "Lose your phone? Rotate the alias from Privacy & sharing and the code stops resolving.",
  ],
} as const;

/* ── Config + alias model ─────────────────────────────────────────────── */

// Freshness window: a Live pass may show blue ONLY on a confirmed read newer
// than this. One constant, the whole fail-closed boundary.
export const WALLET_FRESH_HOURS = 24;

export const ALIAS_ID = "a7f3k9q2"; // opaque alias id, the only thing in the URL
const KEY_FRAG = "Zr8"; // public-alias key, carried in the # fragment
export const HANDLE = "robin";

// Canonical alias URL. Public (incl. every Live pass) carries the fragment
// key; a private QR-carrier carries the opaque id ONLY. Never /u/{handle},
// never an account id, never a re-linkable handle.
export function aliasUrl(isPublic: boolean): string {
  return isPublic
    ? `sti.care/a/${ALIAS_ID}#k=${KEY_FRAG}`
    : `sti.care/a/${ALIAS_ID}`;
}

export interface LivePassStateInput {
  ownerBadge: BadgeState;
  reachable: boolean;
  lastSyncAt: number;
  now: number;
}

// Fail-closed resolver. Blue requires: the owner is actually blue, the pass
// can reach the server, AND the last confirmed read is inside the freshness
// window. Anything else → "gray", the exact same value a genuinely-gray
// owner yields, so a connection problem is indistinguishable from real gray.
export function livePassState({
  ownerBadge,
  reachable,
  lastSyncAt,
  now,
}: LivePassStateInput): BadgeState {
  if (ownerBadge !== "blue") return "gray";
  if (!reachable) return "gray";
  const ageHours = (now - lastSyncAt) / 3.6e6;
  if (ageHours >= WALLET_FRESH_HOURS) return "gray";
  return "blue";
}

export const wordFor = (
  state: BadgeState,
  labels: ProtectionLabel[],
  route: Route,
): string =>
  state === "blue" ? blueHeadline(labels, route) : "No status shared right now";

export const LOGO_MARK = "/assets/logo/logo-mark.svg";
export const LOGO_WORDMARK = "/assets/logo/logo-wordmark.svg";
export const LOGO_WORDMARK_LIGHT = "/assets/logo/logo-wordmark-light.svg";

export type WalletFormat = "qr" | "live";
export type SharingMode = "public" | "link";

/* ── Shared pass parts ────────────────────────────────────────────────── */

// Soft circle avatar on a pass top. Never a photo, never a real name, the
// "name" handed to it is just the handle, for fallback initial.
export function PassAvatar({
  src,
  handle,
  size = 44,
  ring,
}: {
  src?: string | undefined;
  handle: string;
  size?: number;
  ring?: boolean;
}) {
  return (
    <span
      style={{
        flex: "none",
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(255,255,255,0.18)",
        boxShadow: ring ? "0 0 0 2px rgba(255,255,255,0.5)" : "none",
      }}
    >
      {src ? (
        <img
          src={src}
          alt=""
          style={{ width: "100%", height: "100%", display: "block" }}
        />
      ) : (
        <span style={{ fontWeight: 800, color: "#fff", fontSize: size * 0.4 }}>
          {(handle[0] ?? "").toUpperCase()}
        </span>
      )}
    </span>
  );
}

// The alias URL as selectable, screen-reader-friendly text beside the QR.
// ONLY rendered on QR-carrier / public passes, never as a status assertion
// on a private pass face (a private pass IS a QR-carrier and shows no status).
export function UrlText({
  url,
  light,
  center,
}: {
  url: string;
  light?: boolean;
  center?: boolean;
}) {
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 11.5,
        letterSpacing: "-0.01em",
        color: light ? "rgba(255,255,255,0.82)" : "var(--text-muted)",
        wordBreak: "break-all",
        textAlign: center ? "center" : "left",
        lineHeight: 1.35,
      }}
    >
      {url}
    </span>
  );
}

// A faux-QR with either the neutral logo mark (QR-carrier, asserts nothing)
// or the two-state badge (Live) knocked into its centre. The matrix is seeded
// by the opaque ALIAS id, so the code encodes the alias, not the handle.
export function PassQR({
  size = 142,
  kind = "logo",
  state = "blue",
}: {
  size?: number;
  kind?: "logo" | "status";
  state?: BadgeState;
}) {
  return (
    <span style={{ position: "relative", display: "inline-flex" }}>
      <Matrix size={size} seed={ALIAS_ID} hole={9} color="var(--ink-900)" />
      <span
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {kind === "status" ? (
          <span
            style={{
              background: "#fff",
              borderRadius: 9,
              padding: 3,
              display: "inline-flex",
            }}
          >
            <Medallion state={state} size={size * 0.2} />
          </span>
        ) : (
          <img
            src={LOGO_MARK}
            alt=""
            style={{
              width: size * 0.2,
              height: size * 0.2,
              borderRadius: 6,
              background: "#fff",
              padding: 3,
              boxSizing: "border-box",
            }}
          />
        )}
      </span>
    </span>
  );
}

export interface PassProps {
  format?: WalletFormat;
  state?: BadgeState;
  labels?: ProtectionLabel[];
  route?: Route;
  handle?: string;
  avatarSrc?: string | undefined;
  isPublic?: boolean;
}

export interface PassHead {
  state: BadgeState;
  labels: ProtectionLabel[];
  route: Route;
  handle: string;
  avatarSrc?: string | undefined;
}

// Shared per-pass derived values, so each pass body stays under the complexity
// ceiling. Identical to the inline expressions the passes used before.
export interface PassFace {
  live: boolean;
  blue: boolean;
  url: string;
  tags: ProtectionLabel[];
  showTags: boolean;
  qrKind: "logo" | "status";
}

export function passFace({
  format = "qr",
  state = "blue",
  labels = [],
  route = null,
  isPublic = true,
}: Pick<
  PassProps,
  "format" | "state" | "labels" | "route" | "isPublic"
>): PassFace {
  const live = format === "live";
  const blue = state === "blue";
  const tags = tagsFor(labels, route);
  return {
    live,
    blue,
    url: aliasUrl(live ? true : isPublic),
    tags,
    showTags: live && blue && tags.length > 0,
    qrKind: live ? "status" : "logo",
  };
}

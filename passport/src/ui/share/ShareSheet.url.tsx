import { useState, type ReactElement } from "react";
import { Button } from "../../design/components/index.ts";
import {
  Link,
  Globe,
  Copy,
  Check,
  Download,
  Refresh,
} from "../../design/icons.tsx";
import { Matrix, downloadPNG } from "../../lib/qr.tsx";

/* The share sheet's URL card: the QR thumbnail, the link text, and the
   copy/save actions, plus its pending/error states. Lifted out of ShareSheet so
   that file stays under its size/complexity caps. */

const COPY = {
  labelPublic: "Public profile",
  labelLink: "Private link",
  labelName: "Public name",
  notePublic: "Anyone who scans sees just this status.",
  noteLink: "Only people you send this private link to can open it.",
  noteName: "People find you by name and ask before they see your status.",
  copyLink: "Copy link",
  copied: "Copied",
  saveQr: "Save QR image",
  preparing: "Getting your link ready",
  prepareFailed:
    "We couldn't make your link. Check your connection and try again.",
  retry: "Try again",
} as const;

// Canonical opaque alias. Public carries the #fragment key; the private (link)
// form is the bare /a/{id}, its key is handed at share time.
const URL_PUBLIC = "sti.care/a/a7f3k9q2#k=Zr8";
const URL_LINK = "sti.care/a/a7f3k9q2";

// The URL card has four states, driven by `realUrl` plus the prepare error flag:
//   string  -> "ready": the owner's real link + a scannable QR of it.
//   undefined -> "placeholder": no session wired (Storybook), show the demo link.
//   null + no error -> "pending": the app is minting the link; show no URL yet.
//   null + error -> "error": the mint failed; offer a retry.
// The null cases used to fall back to the demo link too, so a stalled or failed
// mint silently showed a realistic fake link and QR that were not the owner's,
// which read as "the link never updates". Pending/error states keep it honest.
export type UrlState = "ready" | "placeholder" | "pending" | "error";

export function urlStateOf(
  realUrl: string | null | undefined,
  error: boolean | undefined,
): UrlState {
  if (typeof realUrl === "string" && realUrl !== "") return "ready";
  if (realUrl === undefined) return "placeholder";
  return error ? "error" : "pending";
}

// Whether a state can be handed off / shared: only when a real (or demo) link
// exists. Pending/error have nothing to share to. A type guard, so callers
// narrow to the pending/error states in the else branch.
export function urlReady(state: UrlState): state is "ready" | "placeholder" {
  return state === "ready" || state === "placeholder";
}

// Resolve what the URL card renders: the real link when present (scheme stripped
// for display), else the demo link for the placeholder (Storybook) state. The QR
// seed tracks the alias id so it varies per link (the matrix is stylized). For
// pending/error there is no link to show, so the url is blank and the seed is the
// stable default (the decorative matrix only needs a seed).
export function displayLink(
  realUrl: string | null | undefined,
  link: boolean,
): { url: string; seed: string } {
  const display =
    typeof realUrl === "string" && realUrl !== ""
      ? realUrl
      : realUrl === undefined
        ? `https://${link ? URL_LINK : URL_PUBLIC}`
        : "";
  const url = display.replace(/^https?:\/\//, "");
  const seed = url.split("/a/")[1]?.split(/[#?]/)[0] ?? "a7f3k9q2";
  return { url, seed };
}

// The QR thumbnail: a real scannable code when a link exists, else the decorative
// (seed-only) matrix, dimmed, so pending/error never shows a scannable code that
// is not the owner's link.
function UrlThumb({
  state,
  url,
  seed,
}: {
  state: UrlState;
  url: string;
  seed: string;
}): ReactElement {
  if (urlReady(state))
    return <Matrix value={`https://${url}`} size={64} color="var(--ink-900)" />;
  return (
    <div style={{ filter: "blur(2px)", opacity: 0.5 }}>
      <Matrix seed={seed} size={64} color="var(--ink-400)" />
    </div>
  );
}

// The three link kinds the card can show: a private one-off link, the durable
// anonymous public link, or the findable public-name (/u/) link.
function cardLabel(link: boolean, named: boolean): string {
  if (named) return COPY.labelName;
  return link ? COPY.labelLink : COPY.labelPublic;
}

function cardNote(link: boolean, named: boolean): string {
  if (named) return COPY.noteName;
  return link ? COPY.noteLink : COPY.notePublic;
}

function CardLabel({
  link,
  named,
}: {
  link: boolean;
  named: boolean;
}): ReactElement {
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        color: "var(--text-subtle)",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      {link ? <Link size={13} /> : <Globe size={13} />} {cardLabel(link, named)}
    </div>
  );
}

// The pending/error body: no link or copy/save, just a calm status and (on
// failure) a retry. Keeps the same row footprint so the sheet doesn't jump.
function UrlStatusBody({
  link,
  named,
  state,
  onRetry,
}: {
  link: boolean;
  named: boolean;
  state: "pending" | "error";
  onRetry: (() => void) | undefined;
}): ReactElement {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <CardLabel link={link} named={named} />
      <div
        style={{
          fontSize: 13,
          color: "var(--text-muted)",
          lineHeight: 1.45,
          margin: "8px 0 10px",
        }}
      >
        {state === "error" ? COPY.prepareFailed : COPY.preparing}
      </div>
      {state === "error" && onRetry !== undefined && (
        <Button
          variant="secondary"
          size="sm"
          icon={<Refresh size={15} />}
          onClick={onRetry}
        >
          {COPY.retry}
        </Button>
      )}
    </div>
  );
}

function UrlReadyBody({
  link,
  named,
  url,
  seed,
  onCopy,
}: {
  link: boolean;
  named: boolean;
  url: string;
  seed: string;
  onCopy: (() => boolean) | undefined;
}): ReactElement {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    // Only confirm when a copy path actually ran, so "Copied" never lies on a
    // device where the clipboard is unavailable.
    if (onCopy?.() === false) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <CardLabel link={link} named={named} />
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 13.5,
          color: "var(--text-strong)",
          margin: "6px 0 6px",
          wordBreak: "break-all",
        }}
      >
        {url}
      </div>
      <div
        style={{
          fontSize: 11.5,
          color: "var(--text-subtle)",
          lineHeight: 1.45,
          marginBottom: 10,
        }}
      >
        {cardNote(link, named)}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Button
          variant="secondary"
          size="sm"
          icon={copied ? <Check size={15} /> : <Copy size={15} />}
          onClick={copy}
        >
          {copied ? COPY.copied : COPY.copyLink}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={<Download size={15} />}
          onClick={() => {
            downloadPNG({ status: "logo", value: `https://${url}`, seed });
          }}
        >
          {COPY.saveQr}
        </Button>
      </div>
    </div>
  );
}

// Whether a ready display URL is the findable public-name link (`/u/{name}`), as
// opposed to an opaque `/a/{id}` alias link. The scheme is already stripped.
function isNamedLink(url: string): boolean {
  return /(^|\/)u\//.test(url);
}

export function UrlCard({
  link,
  state,
  url,
  seed,
  onCopy,
  onRetry,
}: {
  link: boolean;
  state: UrlState;
  url: string;
  seed: string;
  onCopy: (() => boolean) | undefined;
  onRetry: (() => void) | undefined;
}): ReactElement {
  const named = urlReady(state) && isNamedLink(url);
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "center",
        background: "var(--surface-card)",
        borderRadius: "var(--radius-md)",
        padding: 14,
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <UrlThumb state={state} url={url} seed={seed} />
      {urlReady(state) ? (
        <UrlReadyBody
          link={link}
          named={named}
          url={url}
          seed={seed}
          onCopy={onCopy}
        />
      ) : (
        <UrlStatusBody
          link={link}
          named={named}
          state={state}
          onRetry={onRetry}
        />
      )}
    </div>
  );
}

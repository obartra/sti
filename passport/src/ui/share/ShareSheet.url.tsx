import { useState, type ReactElement } from "react";
import { Button } from "../../design/components/index.ts";
import { Link, Copy, Check, Download, Refresh } from "../../design/icons.tsx";
import { Matrix, downloadPNG } from "../../lib/qr.tsx";
import { cx } from "../../lib/cx.ts";
import "./share-sheet.css";

/* The share sheet's URL block: the QR thumbnail, the link text, and the
   copy/save actions, plus its pending/error states. The sheet hands out the
   owner's private keyed link only; public sharing is the findable name, managed
   from the Public names section. Lifted out of ShareSheet so that file stays
   under its size/complexity caps. On the editorial grammar (doc 37) it is the
   sheet's one action callout (.e-card), not a shadowed card. */

const COPY = {
  labelLink: "Private link",
  noteLink: "Only people you send this private link to can open it.",
  copyLink: "Copy link",
  copied: "Copied",
  saveQr: "Save QR image",
  preparing: "Getting your link ready",
  prepareFailed:
    "We couldn't make your link. Check your connection and try again.",
  retry: "Try again",
} as const;

// The canonical opaque private link: the bare /a/{id}; its key is handed at
// share time, never shown in the demo placeholder.
const URL_LINK = "sti.care/a/a7f3k9q2";

// The URL block has four states, driven by `realUrl` plus the prepare error flag:
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

// Resolve what the URL block renders: the real link when present (scheme stripped
// for display), else the demo link for the placeholder (Storybook) state. The QR
// seed tracks the alias id so it varies per link (the matrix is stylized). For
// pending/error there is no link to show, so the url is blank and the seed is the
// stable default (the decorative matrix only needs a seed).
export function displayLink(realUrl: string | null | undefined): {
  url: string;
  seed: string;
} {
  const display =
    typeof realUrl === "string" && realUrl !== ""
      ? realUrl
      : realUrl === undefined
        ? `https://${URL_LINK}`
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
    <div className="sh__url-thumb--pending">
      <Matrix seed={seed} size={64} color="var(--ink-400)" />
    </div>
  );
}

function CardLabel(): ReactElement {
  return (
    <div className="sh__url-label">
      <Link size={13} /> {COPY.labelLink}
    </div>
  );
}

// The pending/error body: no link or copy/save, just a calm status and (on
// failure) a retry. Keeps the same row footprint so the sheet doesn't jump.
function UrlStatusBody({
  state,
  onRetry,
}: {
  state: "pending" | "error";
  onRetry: (() => void) | undefined;
}): ReactElement {
  return (
    <div className="sh__url-body">
      <CardLabel />
      <div className="sh__url-status">
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
  url,
  seed,
  onCopy,
}: {
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
    <div className="sh__url-body">
      <CardLabel />
      <div className="sh__url-link">{url}</div>
      <div className="sh__url-note">{COPY.noteLink}</div>
      <div className="sh__url-actions">
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

export function UrlCard({
  state,
  url,
  seed,
  onCopy,
  onRetry,
}: {
  state: UrlState;
  url: string;
  seed: string;
  onCopy: (() => boolean) | undefined;
  onRetry: (() => void) | undefined;
}): ReactElement {
  return (
    <div className={cx("e-card", "sh__url")}>
      <UrlThumb state={state} url={url} seed={seed} />
      {urlReady(state) ? (
        <UrlReadyBody url={url} seed={seed} onCopy={onCopy} />
      ) : (
        <UrlStatusBody state={state} onRetry={onRetry} />
      )}
    </div>
  );
}

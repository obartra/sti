import { Fragment, useState } from "react";
import type { ReactNode } from "react";
import { Button } from "../../design/components/index.ts";
import { Check, MapPin, Share, Heart } from "../../design/icons.tsx";
import { COPY } from "./conditions.ts";
import type { Tone } from "./conditions.ts";

// Render the source strings' <b>…</b> emphasis without trusting raw HTML.
export function B({ text }: { text: string }): ReactNode {
  const parts = text.split(/<\/?b>/);
  return (
    <Fragment>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <strong key={i} style={{ color: "var(--text-strong)" }}>
            {p}
          </strong>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </Fragment>
  );
}

// Curable / Treatable / Usually goes away, color + word, tones from the
// existing status set (never color alone; the word is always present).
const LABEL_TONES: Record<Tone, [string, string]> = {
  clear: ["var(--status-clear-bg)", "var(--status-clear-fg)"],
  treat: ["var(--status-treat-bg)", "var(--status-treat-fg)"],
  none: ["var(--status-none-bg)", "var(--status-none-fg)"],
};

export function LabelChip({
  label,
  tone,
}: {
  label: string;
  tone: Tone;
}): ReactNode {
  const [bg, fg] = LABEL_TONES[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        background: bg,
        color: fg,
        borderRadius: "var(--radius-pill)",
        padding: "3px 10px",
        fontSize: 11.5,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      <Heart size={11} /> {label}
    </span>
  );
}

export function Disclaimer(): ReactNode {
  return (
    <div
      style={{
        fontSize: 11.5,
        color: "var(--text-subtle)",
        lineHeight: 1.5,
        textAlign: "center",
        padding: "0 8px",
      }}
    >
      {COPY.footer}
    </div>
  );
}

export function ShareRow({
  onShare,
}: {
  onShare?: (() => void) | undefined;
}): ReactNode {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="secondary"
      size="md"
      block
      icon={copied ? <Check size={16} /> : <Share size={16} />}
      onClick={() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
        onShare?.();
      }}
    >
      {copied ? COPY.copied : COPY.shareLabel}
    </Button>
  );
}

export function TestingCta({
  withOfficial,
  onFindTesting,
  onOfficial,
}: {
  withOfficial?: boolean;
  onFindTesting?: (() => void) | undefined;
  onOfficial?: (() => void) | undefined;
}): ReactNode {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <Button
        variant="primary"
        size="lg"
        block
        icon={<MapPin size={18} />}
        onClick={() => onFindTesting?.()}
      >
        {COPY.findTesting}
      </Button>
      <div
        style={{
          fontSize: 12.5,
          color: "var(--text-subtle)",
          textAlign: "center",
        }}
      >
        {COPY.findTestingSub}
      </div>
      {withOfficial && (
        <button
          type="button"
          onClick={() => onOfficial?.()}
          style={{
            appearance: "none",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            font: "inherit",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-accent)",
            textDecoration: "underline",
            textUnderlineOffset: 3,
          }}
        >
          {COPY.official}
        </button>
      )}
    </div>
  );
}

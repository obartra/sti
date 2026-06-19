import { Fragment, useState } from "react";
import type { ReactNode } from "react";
import { Card, Button } from "../../design/components/index.ts";
import { Check, Share, Lock } from "../../design/icons.tsx";

// U=U education card (from sti.care/poz). Faithful port of learn.jsx UU, copy
// verbatim from copy.js (learn.uu). Education anyone can share; deliberately
// separate from anyone's status.
const COPY = {
  label: "U=U",
  title: "Undetectable = Untransmittable",
  intro:
    "A person with HIV who's on treatment and undetectable can't pass HIV through sex. Not lower risk, none. Share this page to say exactly that.",
  qa: [
    [
      "What “undetectable” means",
      "Daily HIV medicine lowers the virus until a test can't find it. Most people get there within about 6 months and stay there.",
    ],
    [
      "Undetectable = Untransmittable",
      "An undetectable person <b>cannot</b> pass HIV to sexual partners. Not lower risk, zero. This is settled science, backed by large studies and the U.S. CDC.",
    ],
    [
      "What it means for a partner",
      "Sex with an undetectable partner carries <b>no</b> risk of HIV. (Condoms still help with other STIs and pregnancy.)",
    ],
    [
      "Sharing this is the responsible move",
      "An undetectable status isn't a warning, it's good news. No stigma, no transmission risk.",
    ],
  ],
  shareLabel: "Share this page",
  copied: "Link copied",
  privacyNote:
    "This card is education anyone can share. Your own passport never shows U=U; an undetectable result simply reads as up to date.",
  disclaimer:
    "U=U is backed by large studies and public health agencies, including the U.S. CDC.",
} as const;

// Render the source strings' <b>…</b> emphasis without trusting raw HTML.
function B({ text }: { text: string }): ReactNode {
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

function ShareRow({ onShare }: { onShare?: (() => void) | undefined }) {
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

export interface UUProps {
  onShare?: (() => void) | undefined;
}

export function UU({ onShare }: UUProps) {
  const c = COPY;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        width: "100%",
        maxWidth: 390,
      }}
    >
      <Card
        style={{
          borderRadius: "var(--radius-lg)",
          padding: 22,
          background: "var(--status-clear-bg)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <span
          style={{
            alignSelf: "flex-start",
            background: "var(--status-clear-base)",
            color: "#fff",
            borderRadius: "var(--radius-pill)",
            padding: "4px 12px",
            fontSize: 12.5,
            fontWeight: 800,
            letterSpacing: "0.04em",
          }}
        >
          {c.label}
        </span>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "var(--status-clear-fg)",
            lineHeight: 1.15,
          }}
        >
          {c.title}
        </h1>
        <p
          style={{
            fontSize: 14.5,
            lineHeight: 1.6,
            color: "var(--status-clear-fg)",
            margin: 0,
            opacity: 0.9,
          }}
        >
          {c.intro}
        </p>
      </Card>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {c.qa.map((row, i) => (
          <Card
            key={i}
            style={{ display: "flex", flexDirection: "column", gap: 6 }}
          >
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "var(--text-strong)",
              }}
            >
              {row[0]}
            </div>
            <div
              style={{
                fontSize: 14,
                lineHeight: 1.6,
                color: "var(--text-body)",
              }}
            >
              <B text={row[1]} />
            </div>
          </Card>
        ))}
      </div>

      <Card variant="tint" style={{ display: "flex", gap: 12 }}>
        <span
          style={{ color: "var(--text-accent)", flex: "none", marginTop: 1 }}
        >
          <Lock size={17} />
        </span>
        <div
          style={{ fontSize: 13, lineHeight: 1.55, color: "var(--text-body)" }}
        >
          {c.privacyNote}
        </div>
      </Card>

      <ShareRow onShare={onShare} />
      <div
        style={{
          fontSize: 11.5,
          color: "var(--text-subtle)",
          lineHeight: 1.5,
          textAlign: "center",
          padding: "0 8px",
        }}
      >
        {c.disclaimer}
      </div>
    </div>
  );
}

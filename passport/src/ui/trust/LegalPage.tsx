import { Card } from "../../design/components/index.ts";
import { useMinWidth } from "../desktop/Desktop.tsx";
import type { LegalBlock, LegalDoc } from "./trustCopy.ts";

// Renders a legal document (privacy policy or terms) as a layered notice (doc 23):
// a plain-language summary sits with each section, and the full binding text is
// kept intact and visible. On a wide screen the summary sits in a column beside
// the binding text (the plain take next to what binds); below the breakpoint they
// stack, summary on top. The binding text is never hidden behind a tap. Pure and
// static, so both pages share one component and stay storyable.

function SummaryBox({ text }: { text: string }) {
  return (
    <p
      style={{
        margin: 0,
        padding: "12px 14px",
        borderRadius: "var(--radius-md)",
        background: "var(--surface-tint)",
        color: "var(--text-body)",
        fontSize: 14,
        lineHeight: 1.5,
      }}
    >
      {text}
    </p>
  );
}

function BindingText({ block }: { block: LegalBlock }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        color: "var(--text-subtle)",
      }}
    >
      {block.paragraphs?.map((p, i) => (
        <p key={i} style={{ margin: 0, fontSize: 13, lineHeight: 1.55 }}>
          {p}
        </p>
      ))}
      {block.bullets && (
        <ul
          style={{
            margin: 0,
            paddingLeft: 18,
            display: "flex",
            flexDirection: "column",
            gap: 5,
          }}
        >
          {block.bullets.map((b, i) => (
            <li key={i} style={{ fontSize: 13, lineHeight: 1.5 }}>
              {b}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LegalSection({
  block,
  twoCol,
}: {
  block: LegalBlock;
  twoCol: boolean;
}) {
  const hasParagraphs = (block.paragraphs?.length ?? 0) > 0;
  const hasBullets = (block.bullets?.length ?? 0) > 0;
  const hasBinding = hasParagraphs || hasBullets;
  // The side-by-side layout only earns its keep when there is both a summary and
  // binding text; a summary-only or binding-only section just spans the width.
  const side = twoCol && Boolean(block.summary) && hasBinding;
  return (
    <Card
      style={{
        borderRadius: "var(--radius-lg)",
        padding: 22,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: 17,
          fontWeight: 800,
          letterSpacing: "-0.01em",
          color: "var(--text-strong)",
        }}
      >
        {block.heading}
      </h2>
      {side ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 0.85fr) minmax(0, 1.15fr)",
            gap: 28,
            alignItems: "start",
          }}
        >
          <div style={{ position: "sticky", top: 24 }}>
            {block.summary && <SummaryBox text={block.summary} />}
          </div>
          <BindingText block={block} />
        </div>
      ) : (
        <>
          {block.summary && <SummaryBox text={block.summary} />}
          {hasBinding && <BindingText block={block} />}
        </>
      )}
    </Card>
  );
}

export function LegalPage({ doc, wide }: { doc: LegalDoc; wide?: boolean }) {
  // The app drives the layout off the viewport; stories/tests can pin it.
  const auto = useMinWidth(1080);
  const twoCol = wide ?? auto;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        width: "100%",
      }}
    >
      <Card
        style={{
          borderRadius: "var(--radius-lg)",
          padding: "26px 24px",
          background: "var(--status-clear-bg)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: "-0.01em",
            color: "var(--text-strong)",
          }}
        >
          {doc.title}
        </h1>
        <p
          style={{
            margin: 0,
            maxWidth: 560,
            fontSize: 15,
            lineHeight: 1.5,
            color: "var(--text-body)",
          }}
        >
          {doc.lead}
        </p>
        <p style={{ margin: 0, fontSize: 12, color: "var(--text-subtle)" }}>
          Last updated {doc.updated}
        </p>
        <p
          style={{
            margin: "4px 0 0",
            maxWidth: 560,
            fontSize: 13,
            lineHeight: 1.5,
            color: "var(--text-body)",
          }}
        >
          {doc.summaryNote}
        </p>
      </Card>

      {doc.blocks.map((block) => (
        <LegalSection key={block.heading} block={block} twoCol={twoCol} />
      ))}
    </div>
  );
}

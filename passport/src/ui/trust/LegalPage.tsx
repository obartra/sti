import { Card } from "../../design/components/index.ts";
import type { LegalBlock, LegalDoc } from "./trustCopy.ts";

// Renders a legal document (privacy policy or terms) as a layered notice (doc 23):
// a plain-language summary sits on top of each section, with the full binding text
// kept intact and visible underneath. The summary helps a reader; the binding text
// below is what legally applies, and it is never hidden behind a tap. Pure and
// static, so both pages share one component and stay storyable.

function LegalSection({ block }: { block: LegalBlock }) {
  return (
    <Card
      style={{
        borderRadius: "var(--radius-lg)",
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 12,
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

      {block.summary && (
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
          {block.summary}
        </p>
      )}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          color: "var(--text-subtle)",
        }}
      >
        {block.paragraphs?.map((p, i) => (
          <p
            key={i}
            style={{
              margin: 0,
              fontSize: 13,
              lineHeight: 1.55,
            }}
          >
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
    </Card>
  );
}

export function LegalPage({ doc }: { doc: LegalDoc }) {
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
            fontSize: 24,
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
            fontSize: 14.5,
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
        <LegalSection key={block.heading} block={block} />
      ))}
    </div>
  );
}

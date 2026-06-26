import type { LegalDoc } from "./trustCopy.ts";

// Renders a legal document (privacy policy or terms) from its structured copy
// (doc 23). Pure and static, so both pages share one component and stay storyable.

export function LegalPage({ doc }: { doc: LegalDoc }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 18,
        width: "100%",
        maxWidth: 390,
      }}
    >
      <header style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <h1
          style={{
            margin: 0,
            fontSize: 24,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "var(--text-strong)",
          }}
        >
          {doc.title}
        </h1>
        <p style={{ margin: 0, fontSize: 14.5, color: "var(--text-body)" }}>
          {doc.lead}
        </p>
        <p style={{ margin: 0, fontSize: 12, color: "var(--text-subtle)" }}>
          Last updated {doc.updated}
        </p>
      </header>

      {doc.blocks.map((block) => (
        <section
          key={block.heading}
          style={{ display: "flex", flexDirection: "column", gap: 8 }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 700,
              color: "var(--text-strong)",
            }}
          >
            {block.heading}
          </h2>
          {block.paragraphs?.map((p, i) => (
            <p
              key={i}
              style={{
                margin: 0,
                fontSize: 13.5,
                lineHeight: 1.55,
                color: "var(--text-body)",
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
                <li
                  key={i}
                  style={{
                    fontSize: 13.5,
                    lineHeight: 1.5,
                    color: "var(--text-body)",
                  }}
                >
                  {b}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

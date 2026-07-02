import { useMinWidth } from "../desktop/Desktop.tsx";
import type { LegalBlock, LegalDoc } from "./trustCopy.ts";
import "./legal-page.css";

// Renders a legal document (privacy policy or terms) as a layered notice (doc 23):
// a plain-language summary sits with each section, and the full binding text is
// kept intact and visible. On a wide screen the summary sits in a column beside
// the binding text (the plain take next to what binds); below the breakpoint they
// stack, summary on top. The binding text is never hidden behind a tap. The two
// registers are distinguished by type (summary louder, binding text quieter),
// never by a tinted box (doc 37). Pure and static, so both pages share one
// component and stay storyable.

function BindingText({ block }: { block: LegalBlock }) {
  return (
    <div className="legal__binding">
      {block.paragraphs?.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      {block.bullets && (
        <ul>
          {block.bullets.map((b, i) => (
            <li key={i}>{b}</li>
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
    <section className="legal__section">
      <h2 className="legal__heading">{block.heading}</h2>
      {side ? (
        <div className="legal__cols">
          <div className="legal__cols-summary">
            {block.summary && <p className="legal__summary">{block.summary}</p>}
          </div>
          <BindingText block={block} />
        </div>
      ) : (
        <>
          {block.summary && <p className="legal__summary">{block.summary}</p>}
          {hasBinding && <BindingText block={block} />}
        </>
      )}
    </section>
  );
}

export function LegalPage({ doc, wide }: { doc: LegalDoc; wide?: boolean }) {
  // The app drives the layout off the viewport; stories/tests can pin it.
  const auto = useMinWidth(1080);
  const twoCol = wide ?? auto;
  return (
    <div className="legal">
      <header className="legal__head">
        <h1 className="e-title">{doc.title}</h1>
        <p className="legal__lead">{doc.lead}</p>
        <p className="e-micro">Last updated {doc.updated}</p>
        <p className="legal__note">{doc.summaryNote}</p>
      </header>

      {doc.blocks.map((block) => (
        <LegalSection key={block.heading} block={block} twoCol={twoCol} />
      ))}
    </div>
  );
}

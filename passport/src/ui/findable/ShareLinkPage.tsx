import { ShareLinkGuide } from "./ShareLinkGuide.tsx";
import { SAMPLE_HANDLE, SHARE_LINK_GUIDE as C } from "./shareLinkGuideCopy.ts";
import { useMinWidth } from "../desktop/Desktop.tsx";

// The public version of the share-your-link guide (docs 16, 17, 23), reachable from
// the landing footer. Mirrors the trust pages: a page heading + lead, then the
// reusable guide. The handle is editable and seeds from the viewer's own public name
// when they are signed in (passed in by the renderer), or a sample name otherwise,
// so it renders for anyone and never exposes a status.

export function ShareLinkPage({ handle }: { handle?: string | undefined }) {
  // Match the trust-center breakpoint so the guide goes two-column in step with the
  // page's rail layout.
  const wide = useMinWidth(1080);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 18,
        width: "100%",
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
          {C.title}
        </h1>
        <p style={{ margin: 0, fontSize: 14.5, color: "var(--text-body)" }}>
          {C.lead}
        </p>
      </header>
      <ShareLinkGuide
        handle={handle ?? SAMPLE_HANDLE}
        showHeader={false}
        editable
        wide={wide}
      />
    </div>
  );
}

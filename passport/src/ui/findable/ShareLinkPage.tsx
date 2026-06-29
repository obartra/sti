import { ShareLinkGuide } from "./ShareLinkGuide.tsx";
import { SAMPLE_HANDLE, SHARE_LINK_GUIDE as C } from "./shareLinkGuideCopy.ts";

// The public version of the share-your-link guide (docs 16, 17, 23), reachable
// logged out from the landing footer. Mirrors the trust pages: a page heading +
// lead, then the reusable guide. It uses a SAMPLE public name only, never a real
// account and never a status, so it renders for anyone without a session.

export function ShareLinkPage() {
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
          {C.title}
        </h1>
        <p style={{ margin: 0, fontSize: 14.5, color: "var(--text-body)" }}>
          {C.lead}
        </p>
      </header>
      <ShareLinkGuide handle={SAMPLE_HANDLE} showHeader={false} />
    </div>
  );
}

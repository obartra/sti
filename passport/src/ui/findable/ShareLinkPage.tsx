import { ShareLinkGuide } from "./ShareLinkGuide.tsx";
import { SAMPLE_HANDLE, SHARE_LINK_GUIDE as C } from "./shareLinkGuideCopy.ts";
import "./findable.css";

// The public version of the share-your-link guide (docs 16, 17, 23), reachable from
// the landing footer. Mirrors the trust pages: a serif page heading + lead, then the
// reusable guide. The handle is editable and seeds from the viewer's own public name
// when they are signed in (passed in by the renderer), or a sample name otherwise,
// so it renders for anyone and never exposes a status. The guide goes two-column
// on its own container width (doc 37), so the page passes no breakpoint down.

export function ShareLinkPage({ handle }: { handle?: string | undefined }) {
  return (
    <div className="slp">
      <header className="slp__head">
        <h1 className="slp__title">{C.title}</h1>
        <p className="slp__lead">{C.lead}</p>
      </header>
      <ShareLinkGuide
        handle={handle ?? SAMPLE_HANDLE}
        showHeader={false}
        editable
      />
    </div>
  );
}

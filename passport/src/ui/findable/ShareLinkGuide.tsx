import { useState, type CSSProperties } from "react";
import { Button, Card } from "../../design/components/index.ts";
import { Globe, Lock, Copy, Check, Download } from "../../design/icons.tsx";
import { Matrix, downloadPNG } from "../../lib/qr.tsx";
import { copyText } from "../../lib/clipboard.ts";
import { BioMock } from "./BioMock.tsx";
import {
  BIO_MOCKS,
  SHARE_LINK_GUIDE as C,
  publicLinkFor,
  publicHttpsLinkFor,
} from "./shareLinkGuideCopy.ts";

// The "share your link" guide (docs 16, 17): helps an owner drop their public
// link into a bio so matches can find them and ask to view. Reusable across two
// placements: in-app right after a public name is claimed (the owner's real
// handle), and a public page off the landing footer (a sample handle, never a
// real status). Pure presentation: it builds the link/QR from `handle`, shows
// one honest line about what a public bio link exposes plus the private-link
// alternative, and three stylized bio-placement mockups.

const sectionTitle: CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  color: "var(--text-strong)",
};

// The link card: the link, a one-tap copy, a QR for in person, and a save action.
function LinkCard({ handle }: { handle: string }) {
  const [copied, setCopied] = useState(false);
  const link = publicLinkFor(handle);
  const https = publicHttpsLinkFor(handle);
  const copy = () => {
    if (!copyText(https)) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <Matrix
          value={https}
          size={84}
          color="var(--ink-900)"
          radius="var(--radius-md)"
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: "var(--text-subtle)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Globe size={13} /> {C.linkLabel}
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono, ui-monospace, monospace)",
              fontSize: 15,
              fontWeight: 700,
              color: "var(--text-strong)",
              margin: "6px 0",
              wordBreak: "break-all",
            }}
          >
            {link}
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: "var(--text-subtle)",
              lineHeight: 1.45,
            }}
          >
            {C.qrNote}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Button
          variant="primary"
          size="sm"
          icon={copied ? <Check size={15} /> : <Copy size={15} />}
          onClick={copy}
        >
          {copied ? C.copied : C.copy}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={<Download size={15} />}
          onClick={() => downloadPNG({ status: "logo", value: https })}
        >
          {C.saveQr}
        </Button>
      </div>
    </Card>
  );
}

// The one honest line about what a public bio link exposes, plus the always-shown
// private-link alternative (doc 16: do not push everyone to public).
function ExposureNote() {
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <span
          style={{ color: "var(--text-accent)", flex: "none", marginTop: 1 }}
        >
          <Lock size={16} />
        </span>
        <div
          style={{ fontSize: 13, color: "var(--text-body)", lineHeight: 1.5 }}
        >
          {C.exposes}
        </div>
      </div>
      <div
        style={{
          borderTop: "1px solid var(--divider)",
          paddingTop: 10,
          fontSize: 12.5,
          color: "var(--text-muted)",
          lineHeight: 1.5,
        }}
      >
        <div style={{ fontWeight: 700, color: "var(--text-strong)" }}>
          {C.altTitle}
        </div>
        <div style={{ marginTop: 2 }}>{C.alt}</div>
      </div>
    </Card>
  );
}

// The stylized bio-placement mockups, with the link highlighted in each.
function Placements({ link }: { link: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <div style={sectionTitle}>{C.placeTitle}</div>
        <div
          style={{
            fontSize: 12.5,
            color: "var(--text-muted)",
            lineHeight: 1.5,
            marginTop: 4,
          }}
        >
          {C.placeLead}
        </div>
      </div>
      {BIO_MOCKS.map((m) => (
        <BioMock key={m.kind} data={m} link={link} />
      ))}
    </div>
  );
}

export interface ShareLinkGuideProps {
  /** The public name to build the link from (the owner's real one in-app, or a
   * sample on the public page). */
  handle: string;
  /** Show the guide's own title + lead (the in-app post-claim moment). The public
   * page supplies its own heading, so it sets this false. Defaults true. */
  showHeader?: boolean | undefined;
}

export function ShareLinkGuide({
  handle,
  showHeader = true,
}: ShareLinkGuideProps) {
  const link = publicLinkFor(handle);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {showHeader && (
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 800,
              letterSpacing: "-0.01em",
              color: "var(--text-strong)",
            }}
          >
            {C.title}
          </h2>
          <div
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              lineHeight: 1.5,
              marginTop: 4,
            }}
          >
            {C.lead}
          </div>
        </div>
      )}
      <LinkCard handle={handle} />
      <ExposureNote />
      <Placements link={link} />
    </div>
  );
}

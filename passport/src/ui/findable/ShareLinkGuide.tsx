import { useState, type CSSProperties } from "react";
import { Button, Card, Field, Input } from "../../design/components/index.ts";
import { Globe, Lock, Copy, Check, Download } from "../../design/icons.tsx";
import { Matrix, downloadPNG } from "../../lib/qr.tsx";
import { copyText } from "../../lib/clipboard.ts";
import { BioMock } from "./BioMock.tsx";
import {
  BIO_MOCKS,
  SAMPLE_HANDLE,
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
              fontSize: 11.5,
              color: "var(--text-subtle)",
              lineHeight: 1.45,
              marginTop: 6,
            }}
          >
            {C.qrNote}
          </div>
        </div>
      </div>
      {/* The link sits on its own full-width row, not squeezed into the column
          beside the QR: a short name there wrapped mid-word (sti.care/u/sa -> m).
          break-word keeps it from splitting inside the name unless it truly must. */}
      <div
        style={{
          fontFamily: "var(--font-mono, ui-monospace, monospace)",
          fontSize: 15,
          fontWeight: 700,
          color: "var(--text-strong)",
          wordBreak: "break-word",
          overflowWrap: "anywhere",
        }}
      >
        {link}
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

// Keep a typed handle to the vanity charset ([a-z0-9_], <= 30) so the previewed
// link and QR are always well-formed as the operator edits.
function sanitizeHandle(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 30);
}

// The editable public-name field: typing it updates the link, QR, copy, and every
// bio mockup live. Only shown on the standalone page (editable), not the in-app
// post-claim moment, where the owner's real claimed name is fixed.
function HandleField({
  handle,
  onChange,
}: {
  handle: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={C.handleLabel} htmlFor="share-handle" hint={C.handleHint}>
      <Input
        id="share-handle"
        value={handle}
        autoComplete="off"
        spellCheck={false}
        placeholder={C.handlePlaceholder}
        onChange={(e) => onChange(sanitizeHandle(e.target.value))}
      />
    </Field>
  );
}

export interface ShareLinkGuideProps {
  /** The public name to build the link from (the owner's real one in-app, or the
   * logged-in / sample one on the public page). Seeds the editable field. */
  handle: string;
  /** Show the guide's own title + lead (the in-app post-claim moment). The public
   * page supplies its own heading, so it sets this false. Defaults true. */
  showHeader?: boolean | undefined;
  /** Offer an input to change the handle so the link/QR/copy adapt (the standalone
   * page). Off for the in-app moment, where the claimed name is fixed. */
  editable?: boolean | undefined;
  /** Lay the link + alternative beside the bio mockups (wide screens). */
  wide?: boolean | undefined;
}

export function ShareLinkGuide({
  handle: initialHandle,
  showHeader = true,
  editable = false,
  wide = false,
}: ShareLinkGuideProps) {
  const [handle, setHandle] = useState(() => sanitizeHandle(initialHandle));
  const effective = handle || SAMPLE_HANDLE;
  const link = publicLinkFor(effective);
  const summary = (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {editable && <HandleField handle={handle} onChange={setHandle} />}
      <LinkCard handle={effective} />
      <ExposureNote />
    </div>
  );
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
      {wide ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
            gap: 16,
            alignItems: "start",
          }}
        >
          {summary}
          <Placements link={link} />
        </div>
      ) : (
        <>
          {summary}
          <Placements link={link} />
        </>
      )}
    </div>
  );
}

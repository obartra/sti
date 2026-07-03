import { useState } from "react";
import { Button, Field, Input } from "../../design/components/index.ts";
import { Globe, Lock, Copy, Check, Download } from "../../design/icons.tsx";
import { Matrix, downloadPNG } from "../../lib/qr.tsx";
import { copyText } from "../../lib/clipboard.ts";
import { BioMock } from "./BioMock.tsx";
import { cx } from "../../lib/cx.ts";
import {
  BIO_MOCKS,
  SAMPLE_HANDLE,
  SHARE_LINK_GUIDE as C,
  publicLinkFor,
  publicHttpsLinkFor,
} from "./shareLinkGuideCopy.ts";
import "./findable.css";

// The "share your link" guide (docs 16, 17): helps an owner drop their public
// link into a bio so matches can find them and ask to view. Reusable across two
// placements: in-app right after a public name is claimed (the owner's real
// handle), and a public page off the landing footer (a sample handle, never a
// real status). Pure presentation: it builds the link/QR from `handle`, shows
// one honest line about what a public bio link exposes plus the private-link
// alternative, and three stylized bio-placement mockups. On the editorial
// grammar (doc 37): the link block is the one action callout; everything
// around it sits on the page surface behind hairlines.

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
    <div className={cx("e-card", "slg__linkcard")}>
      <div className="slg__linkrow">
        <Matrix
          value={https}
          size={84}
          color="var(--ink-900)"
          radius="var(--radius-md)"
        />
        <div className="slg__linkmeta">
          <div className="slg__linklabel">
            <Globe size={13} /> {C.linkLabel}
          </div>
          <div className="slg__qrnote">{C.qrNote}</div>
        </div>
      </div>
      <div className="slg__link">{link}</div>
      <div className="slg__actions">
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
    </div>
  );
}

// The one honest line about what a public bio link exposes, plus the always-shown
// private-link alternative (doc 16: do not push everyone to public).
function ExposureNote() {
  return (
    <div className="slg__exposure">
      <div className="slg__exposure-row">
        <span aria-hidden className="slg__exposure-icon">
          <Lock size={16} />
        </span>
        <div className="slg__exposure-text">{C.exposes}</div>
      </div>
      <div className="slg__alt">
        <div className="slg__alt-title">{C.altTitle}</div>
        <div>{C.alt}</div>
      </div>
    </div>
  );
}

// The stylized bio-placement mockups, with the link highlighted in each.
function Placements({ link }: { link: string }) {
  return (
    <div className="slg__place">
      <div>
        <div className="slg__section-title">{C.placeTitle}</div>
        <div className="slg__section-lead">{C.placeLead}</div>
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
}

export function ShareLinkGuide({
  handle: initialHandle,
  showHeader = true,
  editable = false,
}: ShareLinkGuideProps) {
  const [handle, setHandle] = useState(() => sanitizeHandle(initialHandle));
  const effective = handle || SAMPLE_HANDLE;
  const link = publicLinkFor(effective);
  return (
    <div className="slg">
      {showHeader && (
        <div>
          <h2 className="slg__title">{C.title}</h2>
          <div className="slg__section-lead">{C.lead}</div>
        </div>
      )}
      {/* Two columns when the container allows (findable.css), stacked below. */}
      <div className="slg__body">
        <div className="slg__col">
          {editable && <HandleField handle={handle} onChange={setHandle} />}
          <LinkCard handle={effective} />
          <ExposureNote />
        </div>
        <Placements link={link} />
      </div>
    </div>
  );
}

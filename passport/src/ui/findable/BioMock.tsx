import type { ReactNode } from "react";
import type { BioMock as BioMockData } from "./shareLinkGuideCopy.ts";
import { cx } from "../../lib/cx.ts";
import "./findable.css";

// Stylized "where the link goes" mockups (doc brief). These are our own on-brand
// frames, NOT copies of any dating app's UI (no Grindr/Tinder/Hinge/Sniffies
// chrome, just a neutral profile shell), with the link highlighted so the reader
// sees how it reads in a real bio. Purely decorative; no interaction. As
// depictions of other apps' surfaces they keep a restrained frame and the
// highlight tint (the subject of the picture, not our chrome).

// The highlighted link chip, the focal point of every mock.
function LinkChip({ link }: { link: string }) {
  return <span className="bio__chip">{link}</span>;
}

// Split a "...{link}..." template into text + the highlighted chip.
function renderLine(line: string, link: string): ReactNode {
  const [before = "", after = ""] = line.split("{link}");
  return (
    <>
      {before}
      <LinkChip link={link} />
      {after}
    </>
  );
}

// A tiny decorative avatar dot + name row, shared by the profile mocks so they
// read as "a profile" without copying any real app.
function ProfileTop({ name }: { name: string }) {
  return (
    <div className="bio__profiletop">
      <div className="bio__avatar" />
      <div className="bio__name">{name}</div>
    </div>
  );
}

// A profile "About" card: avatar + name, then the About field with the link.
function ProfileMock({ data, link }: { data: BioMockData; link: string }) {
  return (
    <div className={cx("bio", "bio--profile")}>
      <div className="bio__surface">{data.surface}</div>
      <ProfileTop name="You, 29" />
      <div>
        <div className="bio__fieldlabel">{data.field}</div>
        <div className="bio__line">{renderLine(data.line, link)}</div>
      </div>
    </div>
  );
}

// A one-line bio: just the surface label and the single line with the link.
function OneLineMock({ data, link }: { data: BioMockData; link: string }) {
  return (
    <div className="bio">
      <div className="bio__surface">{data.surface}</div>
      <div className="bio__line">{renderLine(data.line, link)}</div>
    </div>
  );
}

// A link-in-bio row: a stacked list of buttons, the sti.care one highlighted.
function LinkRowMock({ data, link }: { data: BioMockData; link: string }) {
  return (
    <div className="bio">
      <div className="bio__surface">{data.surface}</div>
      <div className="bio__ghost" />
      <div className="bio__cta">{renderLine(data.line, link)}</div>
      <div className="bio__ghost" />
    </div>
  );
}

export interface BioMockProps {
  data: BioMockData;
  /** The display link to drop into the mock, e.g. "sti.care/u/robin". */
  link: string;
}

// Render the right stylized mock for the data's kind.
export function BioMock({ data, link }: BioMockProps) {
  if (data.kind === "profile") return <ProfileMock data={data} link={link} />;
  if (data.kind === "linkrow") return <LinkRowMock data={data} link={link} />;
  return <OneLineMock data={data} link={link} />;
}

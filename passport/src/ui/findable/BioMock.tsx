import type { CSSProperties, ReactNode } from "react";
import type { BioMock as BioMockData } from "./shareLinkGuideCopy.ts";

// Stylized "where the link goes" mockups (doc brief). These are our own on-brand
// frames, NOT copies of any dating app's UI (no Grindr/Tinder/Hinge/Sniffies
// chrome, just a neutral profile shell), with the link highlighted so the reader
// sees how it reads in a real bio. Purely decorative; no interaction.

const frame: CSSProperties = {
  background: "var(--surface-card)",
  borderRadius: "var(--radius-lg)",
  boxShadow: "var(--shadow-sm)",
  border: "1px solid var(--divider)",
  padding: 14,
  overflow: "hidden",
};

const surfaceLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--text-subtle)",
};

const fieldLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "var(--text-muted)",
  marginBottom: 4,
};

// The highlighted link chip, the focal point of every mock.
function LinkChip({ link }: { link: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        fontFamily: "var(--font-mono, ui-monospace, monospace)",
        fontWeight: 700,
        fontSize: 12.5,
        color: "var(--text-accent)",
        background: "var(--accent-soft)",
        borderRadius: "var(--radius-sm, 8px)",
        padding: "1px 6px",
        wordBreak: "break-all",
      }}
    >
      {link}
    </span>
  );
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
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "var(--accent-soft)",
          flex: "none",
        }}
      />
      <div
        style={{ fontSize: 13, fontWeight: 800, color: "var(--text-strong)" }}
      >
        {name}
      </div>
    </div>
  );
}

// A profile "About" card: avatar + name, then the About field with the link.
function ProfileMock({ data, link }: { data: BioMockData; link: string }) {
  return (
    <div
      style={{ ...frame, display: "flex", flexDirection: "column", gap: 10 }}
    >
      <div style={surfaceLabel}>{data.surface}</div>
      <ProfileTop name="You, 29" />
      <div>
        <div style={fieldLabel}>{data.field}</div>
        <div
          style={{ fontSize: 13, color: "var(--text-body)", lineHeight: 1.5 }}
        >
          {renderLine(data.line, link)}
        </div>
      </div>
    </div>
  );
}

// A one-line bio: just the surface label and the single line with the link.
function OneLineMock({ data, link }: { data: BioMockData; link: string }) {
  return (
    <div style={{ ...frame, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={surfaceLabel}>{data.surface}</div>
      <div style={{ fontSize: 13, color: "var(--text-body)", lineHeight: 1.5 }}>
        {renderLine(data.line, link)}
      </div>
    </div>
  );
}

// A link-in-bio row: a stacked list of buttons, the sti.care one highlighted.
function LinkRowMock({ data, link }: { data: BioMockData; link: string }) {
  const ghost: CSSProperties = {
    borderRadius: "var(--radius-md)",
    border: "1px solid var(--divider)",
    background: "var(--surface-sunken)",
    height: 30,
  };
  return (
    <div style={{ ...frame, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={surfaceLabel}>{data.surface}</div>
      <div style={ghost} />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: 32,
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--text-accent)",
          background: "var(--accent-soft)",
        }}
      >
        {renderLine(data.line, link)}
      </div>
      <div style={ghost} />
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

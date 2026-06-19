import { useState } from "react";
import type { CSSProperties } from "react";
import { Card, Badge, Segmented } from "../../design/components/index.ts";
import { Lock, Info, Check } from "../../design/icons.tsx";

// Results: the owner's private clinical history. Faithful port of core-app.jsx
// Results (+ helpers ClinChip, ResultRow), copy verbatim from copy.js (results
// + onlyYou). These details (exact dates, test history, clinical outcomes) are
// OWNER-ONLY: partners never see them, only the overall badge. The clinical
// chip is a deliberately NEUTRAL gray chip, NOT the rejected four-light status
// primitive: "negative"/"treated" are clinical input words, not a shared verdict.
const COPY = {
  results: {
    title: "Results",
    recent: "Recent",
    history: "History",
    note: "These details stay private to you. Partners only ever see your overall status.",
  },
  onlyYou: "Only you",
} as const;

export interface ResultEntry {
  name: string;
  date: string;
  outcome: "negative" | "treated";
  note: string;
}

const RECENT: ResultEntry[] = [
  {
    name: "Full screen panel",
    date: "7 Jun 2026",
    outcome: "negative",
    note: "HIV · chlamydia · gonorrhoea · syphilis",
  },
  {
    name: "HIV",
    date: "7 Jun 2026",
    outcome: "negative",
    note: "Negative · up to date",
  },
  {
    name: "Chlamydia & gonorrhoea",
    date: "7 Jun 2026",
    outcome: "negative",
    note: "Negative · up to date",
  },
];

const HISTORY: ResultEntry[] = [
  {
    name: "Syphilis",
    date: "12 Dec 2025",
    outcome: "treated",
    note: "Treated · course completed Jan 2026",
  },
  {
    name: "Full screen panel",
    date: "2 Sep 2025",
    outcome: "negative",
    note: "All negative",
  },
  { name: "HIV", date: "2 Sep 2025", outcome: "negative", note: "Negative" },
];

type Tab = "recent" | "history";

const chipStyle: CSSProperties = {
  flex: "none",
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  background: "var(--surface-sunken)",
  color: "var(--text-muted)",
  borderRadius: "var(--radius-pill)",
  padding: "4px 11px",
  fontSize: 12.5,
  fontWeight: 700,
  whiteSpace: "nowrap",
};

// Neutral clinical chip, owner-only. Deliberately NOT the traffic-light status
// primitive; "negative" is a clinical input word, not a shared verdict.
function ClinChip({ outcome }: { outcome: ResultEntry["outcome"] }) {
  const treated = outcome === "treated";
  return (
    <span style={chipStyle}>
      <Check size={13} />
      {treated ? "Treated" : "Negative"}
    </span>
  );
}

function ResultRow({ r }: { r: ResultEntry }) {
  return (
    <Card
      pad="sm"
      variant="interactive"
      style={{ display: "flex", alignItems: "center", gap: 14 }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{ fontSize: 15, fontWeight: 600, color: "var(--text-strong)" }}
        >
          {r.name}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
          Tested {r.date} · {r.note}
        </div>
      </div>
      <ClinChip outcome={r.outcome} />
    </Card>
  );
}

export interface ResultsProps {
  recent?: ResultEntry[];
  history?: ResultEntry[];
}

export function Results({ recent = RECENT, history = HISTORY }: ResultsProps) {
  const c = COPY.results;
  const [tab, setTab] = useState<Tab>("recent");
  const list = tab === "recent" ? recent : history;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        width: "100%",
        maxWidth: 390,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
        }}
      >
        <h1
          style={{
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "var(--text-strong)",
          }}
        >
          {c.title}
        </h1>
        <Badge variant="accent">
          <Lock size={12} /> {COPY.onlyYou}
        </Badge>
      </div>
      <Segmented<Tab>
        options={[
          { value: "recent", label: c.recent },
          { value: "history", label: c.history },
        ]}
        value={tab}
        onChange={setTab}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {list.map((r, i) => (
          <ResultRow key={i} r={r} />
        ))}
      </div>
      <Card variant="tint" style={{ display: "flex", gap: 12 }}>
        <span
          style={{ color: "var(--text-accent)", flex: "none", marginTop: 1 }}
        >
          <Info size={18} />
        </span>
        <div
          style={{ fontSize: 13.5, lineHeight: 1.5, color: "var(--text-body)" }}
        >
          {c.note}
        </div>
      </Card>
    </div>
  );
}

import { Card } from "../../design/components/index.ts";
import { Info, ArrowRight } from "../../design/icons.tsx";
import { COPY, LEARN_COPY, LEARN_MAP, Chip, Tag } from "./Report.parts.tsx";
import type { SiteStatus, ReportState } from "./Report.parts.tsx";
import { CorePanelCard } from "./Report.cards.tsx";

interface InfectionCardProps {
  inf: (typeof COPY.infections)[number];
  state: ReportState;
  onLearn?: ((id: string) => void) | undefined;
}

function InfectionTags({
  ps,
  ss,
  v,
}: {
  ps: boolean;
  ss: SiteStatus | null;
  v: string;
}) {
  if (ps) {
    if (ss === "positive") return <Tag>Positive</Tag>;
    if (ss === "covered") return <Tag>Covered</Tag>;
    return null;
  }
  return (
    <>
      {v === "Positive" && <Tag>Positive</Tag>}
      {(v === "Undetectable" || v === "Prior history") && <Tag>Up to date</Tag>}
    </>
  );
}

function SiteEntry({
  inf,
  state,
}: {
  inf: InfectionCardProps["inf"];
  state: ReportState;
}) {
  const c = COPY;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        style={{
          fontSize: 12,
          color: "var(--text-subtle)",
          lineHeight: 1.45,
          display: "flex",
          gap: 6,
          alignItems: "flex-start",
        }}
      >
        <Info size={13} style={{ flex: "none", marginTop: 1 }} /> {c.siteHint}
      </div>
      {c.sites.map(([sk, slabel]) => (
        <div
          key={sk}
          style={{ display: "flex", flexDirection: "column", gap: 6 }}
        >
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              color: "var(--text-muted)",
            }}
          >
            {slabel}
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {c.siteOpts.map((o) => (
              <Chip
                key={o}
                active={state.siteVal(inf.id, sk) === o}
                onClick={() => state.setSite(inf.id, sk, o)}
              >
                {o}
              </Chip>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function DetailEntry({
  state,
  onLearn,
}: {
  state: ReportState;
  onLearn?: ((id: string) => void) | undefined;
}) {
  const c = COPY;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
        {c.detailHint}
      </div>
      <Card variant="tint" pad="sm" style={{ display: "flex", gap: 10 }}>
        <span
          style={{ color: "var(--text-accent)", flex: "none", marginTop: 1 }}
        >
          <Info size={15} />
        </span>
        <span
          style={{
            fontSize: 12.5,
            lineHeight: 1.55,
            color: "var(--text-body)",
          }}
        >
          {LEARN_COPY.panelNote}
        </span>
      </Card>

      {/* CORE-PANEL coverage, owner-only guidance. Blue needs the full core
          panel; the per-site reasoning feeds this card but is never shown to
          a viewer. Updates live as results are entered. */}
      {!state.anyPositive && (
        <CorePanelCard
          touchedAny={state.touchedAny}
          coreComplete={state.coreComplete}
          coreMissing={state.coreMissing}
        />
      )}

      {c.infections.map((inf) => (
        <InfectionCard key={inf.id} inf={inf} state={state} onLearn={onLearn} />
      ))}
    </div>
  );
}

function InfectionCard({ inf, state, onLearn }: InfectionCardProps) {
  const c = COPY;
  const ps = "perSite" in inf;
  const ss = ps ? state.siteStatus(inf.id) : null;
  const v = state.val(inf.id);
  const touched = ps ? ss !== "untouched" : v !== c.notTested;
  const options = "options" in inf ? inf.options : undefined;
  const note = "note" in inf ? inf.note : undefined;
  return (
    <Card
      pad="sm"
      variant={touched ? "default" : "flat"}
      style={{ display: "flex", flexDirection: "column", gap: 9 }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 14.5,
            fontWeight: 700,
            color: "var(--text-strong)",
          }}
        >
          {inf.name}
        </span>
        <InfectionTags ps={ps} ss={ss} v={v} />
      </div>
      {ps ? (
        <SiteEntry inf={inf} state={state} />
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {(options ?? []).map((o) => (
            <Chip key={o} active={v === o} onClick={() => state.set(inf.id, o)}>
              {o}
            </Chip>
          ))}
        </div>
      )}
      {note && touched && (
        <div
          style={{
            fontSize: 12.5,
            color: "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Info size={13} /> {note}
        </div>
      )}
      {touched && LEARN_MAP[inf.id] && (
        <button
          type="button"
          onClick={() => onLearn?.(LEARN_MAP[inf.id] ?? inf.id)}
          style={{
            appearance: "none",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            font: "inherit",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            alignSelf: "flex-start",
            padding: 0,
            fontSize: 12.5,
            fontWeight: 700,
            color: "var(--text-accent)",
          }}
        >
          {LEARN_COPY.learnLink} {inf.name} <ArrowRight size={13} />
        </button>
      )}
    </Card>
  );
}

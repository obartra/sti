import { Info, ArrowRight } from "../../design/icons.tsx";
import { StatusLabel } from "../editorial/StatusLabel.tsx";
import { COPY, LEARN_COPY, LEARN_MAP, Chip } from "./Report.parts.tsx";
import type { SiteStatus, ReportState } from "./Report.parts.tsx";
import { CorePanelCard } from "./Report.cards.tsx";
import "./report.css";

interface InfectionCardProps {
  inf: (typeof COPY.infections)[number];
  state: ReportState;
  onLearn?: ((id: string) => void) | undefined;
}

// The entered state as a status word (doc 37), never a pill: a positive reads
// in the treat ink, covered/up-to-date in the clear ink. Owner-only entry.
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
    if (ss === "positive") return <StatusLabel label="Positive" tone="treat" />;
    if (ss === "covered") return <StatusLabel label="Covered" tone="clear" />;
    return null;
  }
  return (
    <>
      {v === "Positive" && <StatusLabel label="Positive" tone="treat" />}
      {(v === "Undetectable" || v === "Prior history") && (
        <StatusLabel label="Up to date" tone="clear" />
      )}
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
    <div className="rp__sites">
      <div className="rp__site-hint">
        <span aria-hidden className="rp__site-hint-icon">
          <Info size={13} />
        </span>
        {c.siteHint}
      </div>
      {c.sites.map(([sk, slabel]) => (
        <div key={sk} className="rp__site">
          <span className="rp__site-label">{slabel}</span>
          <div className="rp__chips">
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
    <div className="rp__detail">
      <div className="rp__hint">{c.detailHint}</div>
      <div className="rp__aside">
        <span aria-hidden className="rp__aside-icon">
          <Info size={15} />
        </span>
        <span className="rp__aside-text">{LEARN_COPY.panelNote}</span>
      </div>

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
    <div className="rp__inf">
      <div className="rp__inf-head">
        <span className="rp__inf-name">{inf.name}</span>
        <InfectionTags ps={ps} ss={ss} v={v} />
      </div>
      {ps ? (
        <SiteEntry inf={inf} state={state} />
      ) : (
        <div className="rp__chips">
          {(options ?? []).map((o) => (
            <Chip key={o} active={v === o} onClick={() => state.set(inf.id, o)}>
              {o}
            </Chip>
          ))}
        </div>
      )}
      {note && touched && (
        <div className="rp__inf-note">
          <Info size={13} /> {note}
        </div>
      )}
      {touched && LEARN_MAP[inf.id] && (
        <button
          type="button"
          onClick={() => onLearn?.(LEARN_MAP[inf.id] ?? inf.id)}
          className="rp__learn"
        >
          {LEARN_COPY.learnLink} {inf.name} <ArrowRight size={13} />
        </button>
      )}
    </div>
  );
}

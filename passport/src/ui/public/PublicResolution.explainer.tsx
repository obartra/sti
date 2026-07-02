import { useState } from "react";
import { Button } from "../../design/components/index.ts";
import { Info } from "../../design/icons.tsx";
import { cx } from "../../lib/cx.ts";
import { COPY } from "./PublicResolution.copy.ts";
import "./public-resolution.css";

function ExplainerBlock({ onClose }: { onClose: () => void }) {
  return (
    <div className="pres__explainer">
      <div className="pres__explainer-title">{COPY.explainerTitle}</div>
      {COPY.explainer.map((row) => (
        <div key={row[0]} className="pres__explainer-row">
          <div className="pres__explainer-term">{row[0]}</div>
          <div className="pres__explainer-def">{row[1]}</div>
        </div>
      ))}
      <span className="pres__explainer-close">
        <Button variant="secondary" size="sm" onClick={onClose}>
          {COPY.explainerClose}
        </Button>
      </span>
    </div>
  );
}

export function Explainer() {
  const [explainerOpen, setExplainerOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setExplainerOpen((v) => !v);
        }}
        aria-expanded={explainerOpen}
        className="pres__explainer-tap"
      >
        <Info size={16} /> {COPY.explainerTap}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cx(
            "pres__explainer-chev",
            explainerOpen && "pres__explainer-chev--open",
          )}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {explainerOpen && (
        <ExplainerBlock
          onClose={() => {
            setExplainerOpen(false);
          }}
        />
      )}
    </div>
  );
}

import { useState } from "react";
import { Card, Button } from "../../design/components/index.ts";
import { Info } from "../../design/icons.tsx";
import { COPY } from "./PublicResolution.copy.ts";

function ExplainerCard({ onClose }: { onClose: () => void }) {
  return (
    <Card
      variant="flat"
      style={{
        marginTop: 10,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div
        style={{
          fontSize: 15.5,
          fontWeight: 800,
          letterSpacing: "-0.01em",
          color: "var(--text-strong)",
        }}
      >
        {COPY.explainerTitle}
      </div>
      {COPY.explainer.map((row) => (
        <div
          key={row[0]}
          style={{ display: "flex", flexDirection: "column", gap: 3 }}
        >
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 700,
              color: "var(--text-strong)",
            }}
          >
            {row[0]}
          </div>
          <div
            style={{
              fontSize: 13.5,
              lineHeight: 1.55,
              color: "var(--text-body)",
            }}
          >
            {row[1]}
          </div>
        </div>
      ))}
      <Button
        variant="secondary"
        size="sm"
        onClick={onClose}
        style={{ alignSelf: "flex-start" }}
      >
        {COPY.explainerClose}
      </Button>
    </Card>
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
        style={{
          appearance: "none",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          font: "inherit",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "2px 4px",
          fontSize: 13.5,
          fontWeight: 700,
          color: "var(--text-accent)",
        }}
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
          style={{
            flex: "none",
            transform: explainerOpen ? "rotate(180deg)" : "none",
            transition: "transform var(--dur-fast) var(--ease-gentle)",
          }}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {explainerOpen && (
        <ExplainerCard
          onClose={() => {
            setExplainerOpen(false);
          }}
        />
      )}
    </div>
  );
}

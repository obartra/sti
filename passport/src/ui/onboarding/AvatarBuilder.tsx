import type { CSSProperties } from "react";
import { Card } from "../../design/components/index.ts";
import { avatarParts, avatarSrc } from "../../lib/avatars.ts";
import type { AvatarConfig } from "../../lib/avatars.ts";

const chipBase: CSSProperties = {
  appearance: "none",
  cursor: "pointer",
  font: "inherit",
  fontSize: 12.5,
  fontWeight: 600,
  padding: "6px 11px",
  borderRadius: "var(--radius-pill)",
};

const chip = (active: boolean): CSSProperties => ({
  ...chipBase,
  border: "1px solid " + (active ? "var(--accent)" : "var(--border-card)"),
  background: active ? "var(--accent-soft)" : "var(--surface-card)",
  color: active ? "var(--text-accent)" : "var(--text-body)",
});

const chipRow: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  alignItems: "center",
};
const partLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "var(--text-subtle)",
  width: 62,
  flex: "none",
};

export interface AvatarBuilderProps {
  config: AvatarConfig;
  onChange: (next: AvatarConfig) => void;
}

// Avatar builder: pick an animal, a color, and dress it up.
export function AvatarBuilder({ config, onChange }: AvatarBuilderProps) {
  const P = avatarParts;
  const set = (key: keyof AvatarConfig, idx: number) =>
    onChange({ ...config, [key]: idx });
  return (
    <Card
      variant="flat"
      style={{ display: "flex", flexDirection: "column", gap: 14 }}
    >
      <div style={{ display: "flex", justifyContent: "center" }}>
        <img
          src={avatarSrc(config)}
          alt="Your avatar"
          style={{
            width: 96,
            height: 96,
            borderRadius: "50%",
            boxShadow: "var(--shadow-md)",
          }}
        />
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <span style={partLabel}>Animal</span>
        <div style={chipRow}>
          {P.animals.map((a, i) => (
            <button
              key={a.name}
              type="button"
              aria-pressed={config.animal === i}
              style={chip(config.animal === i)}
              onClick={() => set("animal", i)}
            >
              {a.name}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <span style={partLabel}>Color</span>
        <div style={chipRow}>
          {P.colors.map((cset, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Color ${i + 1}`}
              aria-pressed={config.color === i}
              onClick={() => set("color", i)}
              style={{
                appearance: "none",
                cursor: "pointer",
                width: 28,
                height: 28,
                borderRadius: "50%",
                border: "none",
                background: cset[1],
                boxShadow:
                  config.color === i
                    ? "0 0 0 3px var(--accent)"
                    : "0 0 0 1px var(--warm-200)",
              }}
            />
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <span style={partLabel}>Hat</span>
        <div style={chipRow}>
          {P.hats.map((h, i) => (
            <button
              key={h.name}
              type="button"
              aria-pressed={config.hat === i}
              style={chip(config.hat === i)}
              onClick={() => set("hat", i)}
            >
              {h.name}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <span style={partLabel}>Glasses</span>
        <div style={chipRow}>
          {P.glasses.map((g, i) => (
            <button
              key={g.name}
              type="button"
              aria-pressed={config.glasses === i}
              style={chip(config.glasses === i)}
              onClick={() => set("glasses", i)}
            >
              {g.name}
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}

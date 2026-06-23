import type { CSSProperties } from "react";
import { Button, Card } from "../../design/components/index.ts";
import { avatarParts, avatarSrc, randomAvatar } from "../../lib/avatars.ts";
import type { AvatarConfig } from "../../lib/avatars.ts";

const partLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "var(--text-subtle)",
  width: 56,
  flex: "none",
  paddingTop: 12,
};

const swatchRow: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  alignItems: "center",
};

const swatch = (active: boolean): CSSProperties => ({
  appearance: "none",
  cursor: "pointer",
  padding: 0,
  width: 44,
  height: 44,
  borderRadius: "50%",
  overflow: "hidden",
  border: "none",
  background: "transparent",
  boxShadow: active
    ? "0 0 0 3px var(--accent)"
    : "0 0 0 1px var(--border-card)",
});

const swatchImg: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "block",
};

export interface AvatarBuilderProps {
  config: AvatarConfig;
  onChange: (next: AvatarConfig) => void;
}

// Avatar builder: pick a hair, a mood, and a tone. Each option is a live mini
// preview of the avatar with that one part changed, and "Surprise me" rolls a
// fresh random face.
export function AvatarBuilder({ config, onChange }: AvatarBuilderProps) {
  const P = avatarParts;
  const set = (key: keyof AvatarConfig, idx: number) =>
    onChange({ ...config, [key]: idx });
  const shuffle = () =>
    onChange(randomAvatar(Math.floor(Math.random() * 0x7fffffff)));

  const row = (
    label: string,
    key: keyof AvatarConfig,
    options: readonly string[],
  ) => (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <span style={partLabel}>{label}</span>
      <div style={swatchRow}>
        {options.map((name, i) => (
          <button
            key={name}
            type="button"
            aria-label={name}
            aria-pressed={config[key] === i}
            style={swatch(config[key] === i)}
            onClick={() => set(key, i)}
          >
            <img
              src={avatarSrc({ ...config, [key]: i })}
              alt=""
              style={swatchImg}
            />
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <Card
      variant="flat"
      style={{ display: "flex", flexDirection: "column", gap: 14 }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
        }}
      >
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
        <Button variant="secondary" size="sm" onClick={shuffle}>
          Surprise me
        </Button>
      </div>
      {row("Hair", "hair", P.hairs)}
      {row("Mood", "mood", P.moods)}
      {row("Tone", "tone", P.tones)}
    </Card>
  );
}

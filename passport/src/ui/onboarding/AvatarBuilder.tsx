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
  marginBottom: 8,
};

// Fixed columns so the swatches line up in tidy rows instead of ragged wrap.
const swatchGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(6, 1fr)",
  gap: 8,
};

const swatch = (active: boolean): CSSProperties => ({
  appearance: "none",
  cursor: "pointer",
  padding: 0,
  width: "100%",
  aspectRatio: "1 / 1",
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

// Avatar builder: pick a hair, mood, skin color, hair color, and beard. Each
// option is a live mini preview of the avatar with that one part changed, and
// "Surprise me" rolls a fresh random face.
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
    <div>
      <div style={partLabel}>{label}</div>
      <div style={swatchGrid}>
        {options.map((name, i) => (
          <button
            // Color rows share option names (skin and hair use one palette), so the
            // row label disambiguates for accessibility and for tests.
            key={`${key}-${i}`}
            type="button"
            aria-label={`${label}: ${name}`}
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
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
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
      {row("Skin", "skin", P.skins)}
      {row("Hair color", "hairColor", P.hairColors)}
      {row("Beard", "beard", P.beards)}
    </Card>
  );
}

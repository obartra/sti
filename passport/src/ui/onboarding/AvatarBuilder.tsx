import { Button } from "../../design/components/index.ts";
import { Dice } from "../../design/icons.tsx";
import { avatarParts, avatarSrc, randomAvatar } from "../../lib/avatars.ts";
import type { AvatarConfig } from "../../lib/avatars.ts";
import { cx } from "../../lib/cx.ts";
import "./avatar.css";

export interface AvatarBuilderProps {
  config: AvatarConfig;
  onChange: (next: AvatarConfig) => void;
}

// Avatar builder: pick a hair, mood, skin color, hair color, and beard. Each
// option is a live mini preview of the avatar with that one part changed, and
// "Surprise me" rolls a fresh random face. Part rows open with a hairline on
// the host surface (doc 37); the swatch rings are the selection control.
export function AvatarBuilder({ config, onChange }: AvatarBuilderProps) {
  const P = avatarParts;
  const set = (key: keyof AvatarConfig, idx: number) =>
    onChange({ ...config, [key]: idx });
  const shuffle = () =>
    onChange(randomAvatar(Math.floor(Math.random() * 0x7fffffff)));

  // Bald ignores the hair color, so dim that row when a bald style is selected.
  const baldSelected = P.hairIsBald[config.hair] ?? false;

  // Each option shows just what it controls: a color row renders solid color
  // swatches; an asset row (hair, mood, beard) renders a mini avatar of that asset.
  // A disabled row (hair color while bald) dims and stops responding. The swatch
  // color itself is data (the palette hexes), so it stays an inline value.
  const row = (
    label: string,
    key: keyof AvatarConfig,
    options: readonly string[],
    opts: { colors?: readonly string[]; disabled?: boolean } = {},
  ) => (
    <div className={cx("avb__part", opts.disabled && "avb__part--disabled")}>
      <div className="avb__part-label">
        {label}
        {opts.disabled ? " (set by Bald)" : ""}
      </div>
      <div className="avb__grid">
        {options.map((name, i) => (
          <button
            // Color rows share option names (skin and hair use one palette), so the
            // row label disambiguates for accessibility and for tests.
            key={`${key}-${i}`}
            type="button"
            aria-label={`${label}: ${name}`}
            aria-pressed={config[key] === i}
            disabled={opts.disabled ?? false}
            className={cx(
              "avb__swatch",
              config[key] === i && "avb__swatch--on",
              opts.disabled && "avb__swatch--disabled",
            )}
            onClick={() => set(key, i)}
          >
            {opts.colors ? (
              <span
                className="avb__fill"
                style={{ background: opts.colors[i] }}
              />
            ) : (
              <img
                src={avatarSrc({ ...config, [key]: i })}
                alt=""
                className="avb__fill"
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="avb">
      <div className="avb__preview">
        <img
          src={avatarSrc(config)}
          alt="Your avatar"
          className="avb__preview-img"
        />
        <Button variant="secondary" size="sm" onClick={shuffle}>
          <Dice size={16} /> Surprise me
        </Button>
      </div>
      {row("Beard", "beard", P.beards)}
      {row("Hair", "hair", P.hairs)}
      {row("Mood", "mood", P.moods)}
      {row("Skin", "skin", P.skins, { colors: P.skinHexes })}
      {row("Hair color", "hairColor", P.hairColors, {
        colors: P.hairColorHexes,
        disabled: baldSelected,
      })}
    </div>
  );
}

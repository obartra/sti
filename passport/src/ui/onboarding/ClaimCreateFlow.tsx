import { useId, useState } from "react";
import {
  Button,
  Field,
  IconButton,
  Input,
} from "../../design/components/index.ts";
import { Dice, ArrowRight } from "../../design/icons.tsx";
import { randomAvatar } from "../../lib/avatars.ts";
import type { AvatarConfig } from "../../lib/avatars.ts";
import { COPY } from "./claimCopy.ts";
import { funName } from "./funName.ts";

// Only lowercase letters, digits, and underscore make a name (matches the handle
// shape the account accepts). Shared by typing and the shuffle button.
const sanitize = (raw: string) => raw.replace(/[^a-z0-9_]/gi, "").toLowerCase();

// The name field with a shuffle button that fills a short, playful name.
function NameField({
  value,
  error,
  onChange,
  onShuffle,
}: {
  value: string;
  error: string | undefined;
  onChange: (next: string) => void;
  onShuffle: () => void;
}) {
  const inputId = useId();
  return (
    <Field
      label={COPY.nameLabel}
      hint={COPY.nameHint}
      error={error}
      htmlFor={inputId}
    >
      <div style={{ display: "flex", gap: 8 }}>
        <Input
          id={inputId}
          value={value}
          onChange={(e) => onChange(sanitize(e.target.value))}
          style={{ flex: 1 }}
        />
        <IconButton aria-label={COPY.shuffleLabel} onClick={onShuffle}>
          <Dice size={18} />
        </IconButton>
      </div>
    </Field>
  );
}

// The create-account body. It collects only the name (optional, private). A fresh
// account gets a random avatar customized later from the dedicated editor (doc
// 19), so a random one is minted here and carried through. Reach mode (Direct /
// Gated / Findable) is chosen later, at first-run setup (doc 16).
export function CreateFlow({
  busy = false,
  onClaim,
}: {
  busy?: boolean;
  onClaim?:
    | ((handle: string | undefined, avatar: AvatarConfig) => void)
    | undefined;
}) {
  const [name, setName] = useState("");
  const trimmed = name.trim();
  // Empty is allowed (name is optional); if something is typed it needs ≥3 chars.
  const ok = trimmed.length === 0 || trimmed.length >= 3;
  // Seed one random avatar per mount so every new account starts with a face.
  const [avatar] = useState<AvatarConfig>(() =>
    randomAvatar(Math.floor(Math.random() * 0x7fffffff)),
  );

  return (
    <>
      <NameField
        value={name}
        error={trimmed.length > 0 && !ok ? COPY.nameTooShort : undefined}
        onChange={setName}
        onShuffle={() => setName(sanitize(funName()))}
      />
      <Button
        variant="primary"
        size="lg"
        block
        disabled={!ok || busy}
        onClick={() => onClaim?.(trimmed || undefined, avatar)}
      >
        {COPY.cta} <ArrowRight size={18} />
      </Button>
    </>
  );
}

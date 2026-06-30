import { useState } from "react";
import { Button, Card, Field, Input } from "../../design/components/index.ts";

// The local display name editor on Settings: change or clear the name we greet
// you by (the account `handle`, doc 16). Mirrors onboarding's input rules so the
// two never disagree: the handle charset, and an entered name of at least three
// characters (empty is allowed and clears it). Owner-facing only; a link shows it
// to a viewer only when you choose to reveal yourself (doc 15).
const COPY = {
  title: "Your name",
  sub: "The name we greet you by. Only you see it, unless you choose to show it on a link.",
  label: "Your name",
  hint: "Change it or clear it anytime. It’s never required.",
  placeholder: "Pick a display name",
  tooShort: "At least 3 characters.",
  save: "Save",
} as const;

export function NameCard({
  name,
  onSave,
}: {
  name: string | null;
  onSave: (name: string | null) => void;
}) {
  const [value, setValue] = useState(name ?? "");
  const trimmed = value.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < 3;
  const changed = trimmed !== (name ?? "");
  const canSave = !tooShort && changed;
  return (
    <Card
      variant="flat"
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      <div>
        <div
          style={{ fontSize: 15, fontWeight: 700, color: "var(--text-strong)" }}
        >
          {COPY.title}
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--text-muted)",
            lineHeight: 1.5,
            marginTop: 2,
          }}
        >
          {COPY.sub}
        </div>
      </div>
      <Field
        label={COPY.label}
        hint={COPY.hint}
        error={tooShort ? COPY.tooShort : undefined}
      >
        <Input
          value={value}
          placeholder={COPY.placeholder}
          onChange={(e) =>
            setValue(e.target.value.replace(/[^a-z0-9_]/gi, "").toLowerCase())
          }
        />
      </Field>
      <Button
        variant="secondary"
        size="md"
        disabled={!canSave}
        onClick={() => onSave(trimmed || null)}
      >
        {COPY.save}
      </Button>
    </Card>
  );
}

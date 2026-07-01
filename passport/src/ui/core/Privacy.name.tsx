import { useEffect, useRef, useState } from "react";
import { Card, Field, Input } from "../../design/components/index.ts";

// The local display name editor on Settings: change or clear the name we greet
// you by (the account `handle`, doc 16). It is a device-local label, so it saves
// as you type (debounced), with no button. Mirrors onboarding's input rules so the
// two never disagree: the handle charset, and an entered name of at least three
// characters (empty is allowed and clears it). Owner-facing only; a link shows it
// to a viewer only when you choose to reveal yourself (doc 15).
const COPY = {
  label: "Display name",
  hint: "Only you see it, unless you show it on a link. Never required.",
  placeholder: "Pick a display name",
  tooShort: "At least 3 characters.",
  saved: "Saved",
} as const;

// How long after the last keystroke a valid value is persisted.
const SAVE_DELAY_MS = 600;

export function NameCard({
  name,
  onSave,
}: {
  name: string | null;
  onSave: (name: string | null) => void;
}) {
  const [value, setValue] = useState(name ?? "");
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The valid change waiting to be persisted, or `undefined` for "nothing pending"
  // (`null` is a real pending value: clear the name). Read on unmount so a debounce
  // still in flight when the screen closes is flushed rather than dropped.
  const pending = useRef<string | null | undefined>(undefined);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const trimmed = value.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < 3;
  const changed = trimmed !== (name ?? "");

  useEffect(() => {
    if (tooShort || !changed) {
      pending.current = undefined;
      return;
    }
    pending.current = trimmed || null;
    const timer = setTimeout(() => {
      onSaveRef.current(trimmed || null);
      pending.current = undefined;
      setSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 2000);
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [trimmed, tooShort, changed]);

  useEffect(() => {
    return () => {
      // Flush a debounce that had not fired yet, so a fast edit-then-navigate is
      // not silently lost.
      if (pending.current !== undefined) onSaveRef.current(pending.current);
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, []);

  return (
    <Card
      variant="flat"
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      <Field
        label={
          <span
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <span>{COPY.label}</span>
            {saved && (
              <span
                aria-live="polite"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text-accent)",
                }}
              >
                {COPY.saved}
              </span>
            )}
          </span>
        }
        hint={COPY.hint}
        error={tooShort ? COPY.tooShort : undefined}
      >
        <Input
          value={value}
          placeholder={COPY.placeholder}
          onChange={(e) => {
            setValue(e.target.value.replace(/[^a-z0-9_]/gi, "").toLowerCase());
            setSaved(false);
          }}
        />
      </Field>
    </Card>
  );
}

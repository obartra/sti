import { useEffect, useRef, useState } from "react";
import { Field, Input } from "../../design/components/index.ts";
import { sanitizeDisplayName } from "../../store/displayName.ts";
import "./settings.css";

// The local display name editor on Settings: change or clear the name we greet
// you by (the account `handle`, doc 16). It is a device-local label, so it saves
// as you type (debounced), with no button. Mirrors onboarding's input rules so the
// two never disagree: a real name (mixed case and spaces welcome), free-form with no
// minimum (empty is allowed and clears it). Owner-facing only; a link shows it to a
// viewer only when you choose to reveal yourself (doc 15).
const COPY = {
  label: "Display name",
  hint: "Only you see it, unless you show it on a link. Never required.",
  placeholder: "Pick a display name",
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
  const changed = trimmed !== (name ?? "");

  useEffect(() => {
    if (!changed) {
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
  }, [trimmed, changed]);

  useEffect(() => {
    return () => {
      // Flush a debounce that had not fired yet, so a fast edit-then-navigate is
      // not silently lost.
      if (pending.current !== undefined) onSaveRef.current(pending.current);
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, []);

  return (
    <div className="st__block">
      <Field
        label={
          <span className="st__field-label">
            <span>{COPY.label}</span>
            {saved && (
              <span aria-live="polite" className="st__saved">
                {COPY.saved}
              </span>
            )}
          </span>
        }
        hint={COPY.hint}
      >
        <Input
          value={value}
          placeholder={COPY.placeholder}
          onChange={(e) => {
            setValue(sanitizeDisplayName(e.target.value));
            setSaved(false);
          }}
        />
      </Field>
    </div>
  );
}

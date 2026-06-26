import { Switch } from "../../design/components/index.ts";

// "Keep me signed in on this device" (doc 24): the opt-out for a shared device,
// shown at sign-up and at login. Default ON upstream; renders nothing when no
// setter is wired (e.g. a story or screen that does not own the choice).
export function KeepSignedInToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange?: ((v: boolean) => void) | undefined;
}) {
  if (!onChange) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <Switch
        checked={checked}
        onChange={onChange}
        label="Keep me signed in on this device"
      />
      <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-subtle)" }}>
        Choose this only on a device that’s yours.
      </p>
    </div>
  );
}

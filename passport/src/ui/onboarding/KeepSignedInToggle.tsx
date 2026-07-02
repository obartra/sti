import { Switch } from "../../design/components/index.ts";
import "./onboarding.css";

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
    <div className="onb__keep">
      <Switch
        checked={checked}
        onChange={onChange}
        label="Keep me signed in on this device"
      />
      <p className="onb__keep-note">
        Choose this only on a device that’s yours.
      </p>
    </div>
  );
}

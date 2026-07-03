import { Chevron } from "../../design/icons.tsx";
import "./onboarding.css";

// Shared onboarding header row: a "Back" control on the left (chevron + label, a
// clear affordance) and the step progress on the right, so the two never read as
// the same thing.
export function TopBack({
  title,
  onBack,
}: {
  title: string;
  onBack?: (() => void) | undefined;
}) {
  return (
    <div className="onb__head">
      <button type="button" onClick={onBack} className="onb__back">
        <span className="onb__back-icon" aria-hidden="true">
          <Chevron size={16} />
        </span>
        Back
      </button>
      {title && <span className="onb__step">{title}</span>}
    </div>
  );
}

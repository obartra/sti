import { Button } from "../../design/components/index.ts";
import { COPY } from "./Privacy.parts.tsx";
import type { PrivacyState } from "./Privacy.parts.tsx";
import "./settings.css";

// The danger zone: only the irreversible delete lives here, set apart by the
// treat-ink eyebrow and its own hairline (doc 37), never a red-filled card.
// Log out stays out of this section (it is reversible).
export function DangerZone({
  state,
  onDeleted,
}: {
  state: PrivacyState;
  onDeleted?: (() => void) | undefined;
}) {
  return (
    <div className="st__danger">
      <div className="st__danger-label">{COPY.dangerTitle}</div>
      <div>
        <div className="st__row-title">{COPY.deleteTitle}</div>
        <div className="st__row-sub">{COPY.deleteSub}</div>
      </div>
      {!state.confirmDelete ? (
        <Button
          variant="danger"
          size="md"
          block
          onClick={() => state.setConfirmDelete(true)}
        >
          {COPY.deleteCta}
        </Button>
      ) : (
        <div className="st__buttons">
          <Button
            variant="quiet"
            size="md"
            block
            onClick={() => state.setConfirmDelete(false)}
          >
            Keep it
          </Button>
          <Button variant="danger" size="md" block onClick={onDeleted}>
            Delete now
          </Button>
        </div>
      )}
    </div>
  );
}

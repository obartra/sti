import { Card, Button } from "../../design/components/index.ts";
import { Trash } from "../../design/icons.tsx";
import { COPY, fieldLbl } from "./Privacy.parts.tsx";
import type { PrivacyState } from "./Privacy.parts.tsx";

// The danger zone: only the irreversible delete lives here, visually set apart in a
// red-tinted card. Log out stays out of this section (it is reversible).
export function DangerZone({
  state,
  onDeleted,
}: {
  state: PrivacyState;
  onDeleted?: (() => void) | undefined;
}) {
  return (
    <>
      <div style={{ ...fieldLbl, color: "var(--status-expired-fg)" }}>
        {COPY.dangerTitle}
      </div>
      <Card
        variant="flat"
        style={{
          borderColor: "var(--expired-100)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", gap: 12 }}>
          <span
            style={{
              flex: "none",
              width: 40,
              height: 40,
              borderRadius: "var(--radius-sm)",
              background: "var(--expired-50)",
              color: "var(--status-expired-base)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Trash size={20} />
          </span>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "var(--text-strong)",
              }}
            >
              {COPY.deleteTitle}
            </div>
            <div
              style={{
                fontSize: 13,
                color: "var(--text-muted)",
                lineHeight: 1.45,
              }}
            >
              {COPY.deleteSub}
            </div>
          </div>
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
          <div style={{ display: "flex", gap: 10 }}>
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
      </Card>
    </>
  );
}

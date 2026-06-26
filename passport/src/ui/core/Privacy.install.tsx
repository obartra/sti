import { Button } from "../../design/components/index.ts";
import { Download } from "../../design/icons.tsx";
import { COPY } from "./Privacy.parts.tsx";
import { useInstallPrompt } from "../../pwa/useInstallPrompt.ts";

// The square icon chip the controls rows share (warm tile, accent glyph).
const iconChip = {
  flex: "none" as const,
  width: 40,
  height: 40,
  borderRadius: "var(--radius-sm)",
  background: "var(--accent-soft)",
  color: "var(--text-accent)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

// The Chromium install row (doc 22 section F): one quiet "Add to home screen" entry,
// shown only when the browser offered a prompt and the app is not already installed.
// Self-contained via the install hook, so no prop drilling; absent on iOS and once
// installed (its iOS counterpart is the push row's hint).
export function InstallRow() {
  const { canInstall, install } = useInstallPrompt();
  if (!canInstall) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "10px 8px",
      }}
    >
      <span style={iconChip}>
        <Download size={20} />
      </span>
      <div style={{ flex: 1 }}>
        <div
          style={{ fontSize: 15, fontWeight: 600, color: "var(--text-strong)" }}
        >
          {COPY.installRow}
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--text-muted)",
            lineHeight: 1.5,
            marginTop: 2,
          }}
        >
          {COPY.installRowSub}
        </div>
      </div>
      <Button variant="secondary" size="sm" onClick={install}>
        {COPY.installCta}
      </Button>
    </div>
  );
}

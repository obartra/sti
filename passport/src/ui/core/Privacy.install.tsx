import { Button } from "../../design/components/index.ts";
import { Download } from "../../design/icons.tsx";
import { COPY } from "./Privacy.parts.tsx";
import { useInstallPrompt } from "../../pwa/useInstallPrompt.ts";
import "./settings.css";

// The Chromium install row (doc 22 section F): one quiet "Add to home screen" entry,
// shown only when the browser offered a prompt and the app is not already installed.
// Self-contained via the install hook, so no prop drilling; absent on iOS and once
// installed (its iOS counterpart is the push row's hint).
export function InstallRow() {
  const { canInstall, install } = useInstallPrompt();
  if (!canInstall) return null;
  return (
    <div className="st__row">
      <span aria-hidden className="st__row-icon">
        <Download size={18} />
      </span>
      <div className="st__row-body">
        <div className="st__row-title">{COPY.installRow}</div>
        <div className="st__row-sub">{COPY.installRowSub}</div>
      </div>
      <Button variant="secondary" size="sm" onClick={install}>
        {COPY.installCta}
      </Button>
    </div>
  );
}

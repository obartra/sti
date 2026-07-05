import { useEffect, useRef } from "react";
import type { AliasLink } from "../../store/index.ts";
import { QrCode, X } from "../../design/icons.tsx";
import "./connect.css";

/* The demo scanner (doc 28). The demo has no camera and nothing real to point at,
   so the Scan tile can't open a live viewfinder. It simulates a successful scan
   instead: the same dark scanner chrome, a brief beat, then it resolves to the
   seeded demo peer, exactly as if their code had been read. No demo-only button,
   the real Scan tile just hands back a sample connection. The id/key are
   placeholders: the demo store resolves any link to the peer card. */

const COPY = {
  title: "Scan a code",
  hint: "Opening a sample connection.",
  close: "Close",
} as const;

const DEMO_SCAN_LINK: AliasLink = { id: "demo-scan", key: "demo" };
const SCAN_DELAY_MS = 1100;

export interface DemoScannerProps {
  /** Called once, after a brief beat, with the seeded demo peer link. */
  onResult: (link: AliasLink) => void;
  onBack: () => void;
}

export function DemoScanner({ onResult, onBack }: DemoScannerProps) {
  // Read onResult through a ref so the beat fires exactly once on mount, even if the
  // screen re-renders with a fresh callback mid-scan (mirrors QrScanner's pattern).
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  useEffect(() => {
    const timer = setTimeout(() => onResultRef.current(DEMO_SCAN_LINK), SCAN_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="qrs">
      <button
        type="button"
        onClick={onBack}
        aria-label={COPY.close}
        className="qrs__close"
      >
        <X size={18} />
      </button>
      <div className="qrs__viewport qrs__viewport--demo">
        <QrCode size={72} className="qrs__demo-icon" />
      </div>
      <div className="qrs__title">{COPY.title}</div>
      <div className="qrs__hint">{COPY.hint}</div>
    </div>
  );
}

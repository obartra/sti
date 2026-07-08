/**
 * The in-person connect screen (doc 25): one surface that shows YOUR code and
 * runs the camera at once, so neither person picks a role and neither taps
 * anything. The first decoded offer completes this side silently and the screen
 * advances to its completion (warm when both are blue, one neutral line when a
 * badge is gray, never a verdict). A scanned plain link still routes to the view
 * flow, exactly what scanning did before this gesture existed. The camera dying
 * never kills the show half: the other person can still scan this screen.
 *
 * LinkupView is the pure surface (stories and tests reach every phase without a
 * camera); Linkup wires it to the flow state machine and the live scanner.
 */

import { useRef, type RefObject } from "react";
import { Button } from "../../design/components/index.ts";
import { X } from "../../design/icons.tsx";
import { Matrix } from "../../lib/qr.tsx";
import { Medallion, type BadgeState } from "../badge-card.tsx";
import { parseScannedConnect } from "../../store/index.ts";
import { cameraMessage, useQrScan, type ScanStatus } from "./QrScanner.tsx";
import {
  useLinkupFlow,
  type LinkupDeps,
  type LinkupPhase,
  type PeerView,
} from "./useLinkupFlow.ts";
import "./connect.css";
import "./linkup.css";

const COPY = {
  title: "Connect in person",
  hint: "Point cameras at each other's screens.",
  preparing: "Getting your code ready",
  prepareFailed:
    "We couldn't make your code. Check your connection and try again.",
  retry: "Try again",
  linked: "You're connected.",
  bothBlue: "You're both up to date.",
  oneGray: "Free testing is easy to find when you want it.",
  you: "You",
  them: "Them",
  done: "Done",
  close: "Close",
} as const;

// The line under a fresh connection: warm when both badges read blue, else the
// single neutral routing-to-care line (doc 25 decision 3; never a verdict).
export function completionLine(
  ownerBadge: BadgeState,
  peerBadge: BadgeState | null,
): string {
  return ownerBadge === "blue" && peerBadge === "blue"
    ? COPY.bothBlue
    : COPY.oneGray;
}

function MyCode({
  phase,
  onRetry,
}: {
  phase: Exclude<LinkupPhase, { kind: "linked" }>;
  onRetry: () => void;
}) {
  if (phase.kind === "showing") {
    return (
      <div className="lk__code" data-testid="lk-code">
        <Matrix value={phase.url} size={196} color="var(--ink-900)" />
      </div>
    );
  }
  return (
    <div className="lk__code lk__code--waiting">
      <div className="lk__status">
        {phase.kind === "failed" ? COPY.prepareFailed : COPY.preparing}
      </div>
      {phase.kind === "failed" && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {COPY.retry}
        </Button>
      )}
    </div>
  );
}

// The camera half. On a camera-failure state the show half above stays useful
// (the other person scans this screen), so the failure is one quiet line.
function Camera({
  videoRef,
  status,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  status: ScanStatus;
}) {
  if (status !== "scanning") {
    return <div className="lk__camera-note">{cameraMessage(status)}</div>;
  }
  return (
    <div className="qrs__viewport lk__viewport">
      <video ref={videoRef} muted playsInline className="qrs__video" />
    </div>
  );
}

function Person({ name, badge }: { name: string; badge: BadgeState | null }) {
  return (
    <div className="lk__person">
      <Medallion state={badge === "blue" ? "blue" : "gray"} size={44} />
      <div className="lk__person-name">{name}</div>
    </div>
  );
}

function Linked({
  ownerBadge,
  peer,
  onDone,
}: {
  ownerBadge: BadgeState;
  peer: PeerView;
  onDone: () => void;
}) {
  return (
    <div className="lk__done">
      <div className="e-title">{COPY.linked}</div>
      <div className="lk__pair">
        <Person name={COPY.you} badge={ownerBadge} />
        <Person
          name={peer.label !== "" ? peer.label : COPY.them}
          badge={peer.badge}
        />
      </div>
      <div className="lk__line">{completionLine(ownerBadge, peer.badge)}</div>
      <Button variant="primary" size="lg" block onClick={onDone}>
        {COPY.done}
      </Button>
    </div>
  );
}

export interface LinkupViewProps {
  phase: LinkupPhase;
  /** The owner's own shared badge, for the completion pair. */
  ownerBadge: BadgeState;
  scanStatus: ScanStatus;
  videoRef: RefObject<HTMLVideoElement | null>;
  onRetry: () => void;
  onClose: () => void;
}

export function LinkupView({
  phase,
  ownerBadge,
  scanStatus,
  videoRef,
  onRetry,
  onClose,
}: LinkupViewProps) {
  return (
    <div className="lk" data-testid="linkup">
      <button
        type="button"
        onClick={onClose}
        aria-label={COPY.close}
        className="qrs__close"
      >
        <X size={18} />
      </button>
      {phase.kind === "linked" ? (
        <Linked ownerBadge={ownerBadge} peer={phase.peer} onDone={onClose} />
      ) : (
        <>
          <div className="qrs__title">{COPY.title}</div>
          <MyCode phase={phase} onRetry={onRetry} />
          <div className="qrs__hint">{COPY.hint}</div>
          <Camera videoRef={videoRef} status={scanStatus} />
        </>
      )}
    </div>
  );
}

export interface LinkupProps extends LinkupDeps {
  /** The owner's own shared badge, for the completion pair. */
  ownerBadge: BadgeState;
}

export function Linkup({ ownerBadge, ...deps }: LinkupProps) {
  const flow = useLinkupFlow(deps);
  const videoRef = useRef<HTMLVideoElement>(null);
  const status = useQrScan(videoRef, parseScannedConnect, flow.onScanned);

  return (
    <LinkupView
      phase={flow.phase}
      ownerBadge={ownerBadge}
      scanStatus={status}
      videoRef={videoRef}
      onRetry={flow.onRetry}
      onClose={flow.onClose}
    />
  );
}

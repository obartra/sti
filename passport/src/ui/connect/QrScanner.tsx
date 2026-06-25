import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { parseScannedLink } from "../../store/index.ts";
import type { AliasLink } from "../../store/index.ts";
import { Button } from "../../design/components/index.ts";
import { X } from "../../design/icons.tsx";

/* The in-app QR scanner (doc 16). Opens the rear camera, samples frames, and
   decodes with jsQR. A scanned code is untrusted: only a well-formed alias link
   to our own site resolves (parseScannedLink), so a malicious QR can't redirect
   the viewer off-site; any other code is ignored and scanning continues. The
   camera plumbing is browser-only and can't run in jsdom; the security-critical
   decode-and-route decision lives in parseScannedLink, which is unit-tested. */

const COPY = {
  title: "Scan a code",
  hint: "Point your camera at their code.",
  denied:
    "Camera access is off. Allow it in your browser settings, or ask them to send you the link instead.",
  unsupported:
    "This device can’t open the camera here. Ask them to send you the link instead.",
  close: "Close",
} as const;

type Status = "scanning" | "denied" | "unsupported";
type Decoder = (typeof import("jsqr"))["default"];

// Sample one video frame and decode it: returns a valid passport link, or null
// (frame not ready, no QR, or a QR that is not an alias link to our own site).
function scanFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  decode: Decoder,
): AliasLink | null {
  if (video.readyState !== video.HAVE_ENOUGH_DATA) return null;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const found = decode(frame.data, frame.width, frame.height);
  return found === null
    ? null
    : parseScannedLink(found.data, window.location.host);
}

// Open the camera and decode frames until a valid passport link is found. The
// effect runs once; onResult is read through a ref so a changing callback never
// tears down and reopens the stream.
function useQrScan(
  videoRef: RefObject<HTMLVideoElement | null>,
  onResult: (link: AliasLink) => void,
): Status {
  const [status, setStatus] = useState<Status>("scanning");
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    // `mediaDevices` is absent in insecure contexts / old browsers; the DOM
    // types wrongly assume it is always present, hence the widening cast.
    const media = navigator.mediaDevices as MediaDevices | undefined;
    if (media === undefined) {
      setStatus("unsupported");
      return;
    }
    let raf = 0;
    let done = false;
    let stream: MediaStream | null = null;
    // jsQR is loaded lazily (its own chunk) so it stays off the initial bundle;
    // the scanner is behind a tap, so the load overlaps opening the camera.
    let decode: Decoder | null = null;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const tick = () => {
      const video = videoRef.current;
      if (done || video === null || ctx === null || decode === null) {
        if (!done) raf = requestAnimationFrame(tick);
        return;
      }
      const link = scanFrame(video, canvas, ctx, decode);
      if (link !== null) {
        done = true;
        onResultRef.current(link);
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    Promise.all([
      import("jsqr"),
      media.getUserMedia({ video: { facingMode: "environment" } }),
    ])
      .then(async ([mod, s]) => {
        // getUserMedia resolves asynchronously; if the effect was already torn
        // down (unmount, or StrictMode's double-invoke) the cleanup ran before
        // `stream` was set, so stop this freshly-acquired stream here or the
        // camera leaks (track stays live, light stays on).
        if (done) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        decode = mod.default;
        stream = s;
        const video = videoRef.current;
        if (video === null) return;
        video.srcObject = s;
        await video.play();
        raf = requestAnimationFrame(tick);
      })
      .catch(() => setStatus("denied"));

    return () => {
      done = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [videoRef]);

  return status;
}

function Viewfinder({
  videoRef,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
}) {
  return (
    <>
      <div
        style={{
          position: "relative",
          width: 240,
          height: 240,
          borderRadius: "var(--radius-xl)",
          overflow: "hidden",
          boxShadow: "0 0 0 2px rgba(255,255,255,0.85)",
        }}
      >
        <video
          ref={videoRef}
          muted
          playsInline
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
      <div style={{ fontSize: 15, fontWeight: 700 }}>{COPY.title}</div>
      <div
        style={{
          fontSize: 13.5,
          color: "rgba(255,255,255,0.8)",
          maxWidth: 280,
          lineHeight: 1.5,
        }}
      >
        {COPY.hint}
      </div>
    </>
  );
}

function ScanMessage({
  status,
  onBack,
}: {
  status: "denied" | "unsupported";
  onBack: () => void;
}) {
  return (
    <>
      <div style={{ fontSize: 15, fontWeight: 700 }}>{COPY.title}</div>
      <div
        style={{
          fontSize: 13.5,
          color: "rgba(255,255,255,0.8)",
          maxWidth: 300,
          lineHeight: 1.5,
        }}
      >
        {status === "denied" ? COPY.denied : COPY.unsupported}
      </div>
      <Button variant="secondary" size="lg" onClick={onBack}>
        {COPY.close}
      </Button>
    </>
  );
}

export interface QrScannerProps {
  /** Called once with the parsed link when a valid passport QR is decoded. */
  onResult: (link: AliasLink) => void;
  onBack: () => void;
}

export function QrScanner({ onResult, onBack }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const status = useQrScan(videoRef, onResult);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "#0B0B14",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        gap: 20,
        padding: 24,
        textAlign: "center",
      }}
    >
      <button
        type="button"
        onClick={onBack}
        aria-label={COPY.close}
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          appearance: "none",
          border: "none",
          background: "rgba(255,255,255,0.16)",
          width: 38,
          height: 38,
          borderRadius: "50%",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: "#fff",
        }}
      >
        <X size={18} />
      </button>

      {status === "scanning" ? (
        <Viewfinder videoRef={videoRef} />
      ) : (
        <ScanMessage status={status} onBack={onBack} />
      )}
    </div>
  );
}

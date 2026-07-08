import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { parseScannedCode } from "../../store/index.ts";
import type { ScannedCode } from "../../store/index.ts";
import { Button } from "../../design/components/index.ts";
import { X } from "../../design/icons.tsx";
import "./connect.css";

/* The in-app QR scanner (doc 16). Opens the camera, samples frames, and decodes
   with jsQR. A scanned code is untrusted: only a well-formed passport link
   resolves (parseScannedCode: the strict alias-link shape, plus the contact
   invite riding it when the code is one), and we open the parsed payload inside
   our own resolution flow, never navigate to the scanned URL, so a malicious QR
   can't redirect the viewer off-site; any other code is ignored and scanning
   continues. The camera plumbing is browser-only and can't run in jsdom; the
   security-critical decode-and-route decision lives in parseScannedCode, which
   is unit-tested, and the camera-error mapping lives in cameraStatus, also
   unit-tested. */

const COPY = {
  title: "Scan a code",
  hint: "Point your camera at their code.",
  denied:
    "Camera access is off. Allow it in your browser settings, or ask them to send you the link instead.",
  noCamera:
    "We couldn't find a camera on this device. Ask them to send you the link instead.",
  unsupported:
    "This device can't open the camera here. Ask them to send you the link instead.",
  close: "Close",
} as const;

type Status = "scanning" | "denied" | "no-camera" | "unsupported";
type Decoder = (typeof import("jsqr"))["default"];

// Map a getUserMedia rejection to the status the viewer should see. A permission
// denial (NotAllowedError/SecurityError) is the only case that means "access is
// off"; a missing/unusable camera (NotFoundError and friends) is its own honest
// message, and anything else falls back to the generic unsupported note. Pure, so
// it is unit-tested without a real camera.
export function cameraStatus(err: unknown): Exclude<Status, "scanning"> {
  const name = err instanceof Error ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  if (
    name === "NotFoundError" ||
    name === "DevicesNotFoundError" ||
    name === "OverconstrainedError"
  ) {
    return "no-camera";
  }
  return "unsupported";
}

// Sample one video frame and decode it: returns a valid passport code, or null
// (frame not ready, no QR, or a QR that is not a passport link).
function scanFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  decode: Decoder,
): ScannedCode | null {
  if (video.readyState !== video.HAVE_ENOUGH_DATA) return null;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const found = decode(frame.data, frame.width, frame.height);
  return found === null ? null : parseScannedCode(found.data);
}

// Open the camera, preferring the rear one but not requiring it. facingMode is a
// soft preference, so most devices ignore it and hand back their only camera; a
// desktop with just a front camera still opens. On the rare browser that treats
// the preference as a hard constraint and has no rear camera (OverconstrainedError),
// retry once with no facingMode so the front camera is accepted rather than failing.
async function openCamera(media: MediaDevices): Promise<MediaStream> {
  try {
    return await media.getUserMedia({ video: { facingMode: "environment" } });
  } catch (err) {
    if (err instanceof Error && err.name === "OverconstrainedError") {
      return media.getUserMedia({ video: true });
    }
    throw err;
  }
}

// Open the camera and decode frames until a valid passport link is found. The
// effect runs once; onResult is read through a ref so a changing callback never
// tears down and reopens the stream.
function useQrScan(
  videoRef: RefObject<HTMLVideoElement | null>,
  onResult: (code: ScannedCode) => void,
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
      const code = scanFrame(video, canvas, ctx, decode);
      if (code !== null) {
        done = true;
        onResultRef.current(code);
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    const start = async (): Promise<void> => {
      // Ask for the camera on its own FIRST, so the permission prompt fires and a
      // rejection is a genuine camera error (mapped by cameraStatus). Only then
      // load jsQR: bundling the two would let a jsQR chunk-load failure surface as
      // a false "camera denied", which is the bug this splits apart.
      const s = await openCamera(media);
      const mod = await import("jsqr");
      // Both awaits resolve asynchronously; if the effect was already torn down
      // (unmount, or StrictMode's double-invoke) the cleanup ran before `stream`
      // was set, so stop this freshly-acquired stream here or the camera leaks
      // (track stays live, light stays on).
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
    };

    void start().catch((err: unknown) => {
      if (!done) setStatus(cameraStatus(err));
    });

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
      <div className="qrs__viewport">
        <video ref={videoRef} muted playsInline className="qrs__video" />
      </div>
      <div className="qrs__title">{COPY.title}</div>
      <div className="qrs__hint">{COPY.hint}</div>
    </>
  );
}

function messageFor(status: Exclude<Status, "scanning">): string {
  if (status === "denied") return COPY.denied;
  if (status === "no-camera") return COPY.noCamera;
  return COPY.unsupported;
}

function ScanMessage({
  status,
  onBack,
}: {
  status: Exclude<Status, "scanning">;
  onBack: () => void;
}) {
  return (
    <>
      <div className="qrs__title">{COPY.title}</div>
      <div className="qrs__hint">{messageFor(status)}</div>
      <Button variant="secondary" size="lg" onClick={onBack}>
        {COPY.close}
      </Button>
    </>
  );
}

export interface QrScannerProps {
  /** Called once with the parsed code when a valid passport QR is decoded. */
  onResult: (code: ScannedCode) => void;
  onBack: () => void;
}

export function QrScanner({ onResult, onBack }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const status = useQrScan(videoRef, onResult);

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

      {status === "scanning" ? (
        <Viewfinder videoRef={videoRef} />
      ) : (
        <ScanMessage status={status} onBack={onBack} />
      )}
    </div>
  );
}

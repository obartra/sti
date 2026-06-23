import { render, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { QrScanner } from "./QrScanner.tsx";

/* The camera capture itself is browser-only (jsdom has no real getUserMedia), so
   this only exercises the lifecycle guard: when the scanner unmounts before the
   camera promise resolves (the StrictMode double-invoke / fast-close case), the
   freshly-acquired stream must be stopped, not attached to a dead effect. */

afterEach(() => {
  vi.restoreAllMocks();
  // Drop the mocked mediaDevices so other suites see the real (absent) value.
  Reflect.deleteProperty(navigator, "mediaDevices");
});

function mockCamera() {
  const stop = vi.fn();
  let resolveStream!: (s: MediaStream) => void;
  const stream = new Promise<MediaStream>((res) => {
    resolveStream = res;
  });
  const fakeStream = {
    getTracks: () => [{ stop } as unknown as MediaStreamTrack],
  } as unknown as MediaStream;
  const getUserMedia = vi.fn(() => stream);
  Object.defineProperty(navigator, "mediaDevices", {
    value: { getUserMedia },
    configurable: true,
  });
  return { stop, resolveStream, fakeStream, getUserMedia };
}

describe("QrScanner camera lifecycle", () => {
  it("stops the stream when it unmounts before getUserMedia resolves", async () => {
    const { stop, resolveStream, fakeStream, getUserMedia } = mockCamera();

    const { unmount } = render(
      <QrScanner onResult={vi.fn()} onBack={vi.fn()} />,
    );
    await waitFor(() => expect(getUserMedia).toHaveBeenCalled());

    // Tear down before the camera resolves, then let it resolve.
    unmount();
    resolveStream(fakeStream);

    // The late stream must be stopped rather than left running.
    await waitFor(() => expect(stop).toHaveBeenCalledTimes(1));
  });
});

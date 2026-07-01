import { render, waitFor, screen } from "@testing-library/react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { QrScanner, cameraStatus } from "./QrScanner.tsx";

function namedError(name: string): Error {
  const e = new Error(name);
  e.name = name;
  return e;
}

// jsdom has no real decoder or media playback; stub both so the "camera opened"
// path can run without touching the actual jsQR chunk or a real <video>.
// The play spy is re-armed each test since afterEach restores all mocks.
vi.mock("jsqr", () => ({ default: () => null }));
beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
});

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

describe("cameraStatus (getUserMedia error mapping)", () => {
  it("maps a permission denial to 'denied'", () => {
    expect(cameraStatus(namedError("NotAllowedError"))).toBe("denied");
    expect(cameraStatus(namedError("SecurityError"))).toBe("denied");
  });

  it("maps a missing/unusable camera to 'no-camera'", () => {
    for (const name of [
      "NotFoundError",
      "DevicesNotFoundError",
      "OverconstrainedError",
    ]) {
      expect(cameraStatus(namedError(name))).toBe("no-camera");
    }
  });

  it("maps anything else (incl. a non-Error) to 'unsupported'", () => {
    expect(cameraStatus(namedError("NotReadableError"))).toBe("unsupported");
    expect(cameraStatus(namedError("AbortError"))).toBe("unsupported");
    expect(cameraStatus("chunk load failed")).toBe("unsupported");
    expect(cameraStatus(undefined)).toBe("unsupported");
  });
});

describe("QrScanner surfaces the mapped camera error", () => {
  it("shows the permission-denied copy when getUserMedia is NotAllowedError", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: vi.fn(() =>
          Promise.reject(namedError("NotAllowedError")),
        ),
      },
      configurable: true,
    });
    render(<QrScanner onResult={vi.fn()} onBack={vi.fn()} />);
    expect(await screen.findByText(/Camera access is off/)).toBeInTheDocument();
  });

  it("shows the no-camera copy when getUserMedia is NotFoundError", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: vi.fn(() => Promise.reject(namedError("NotFoundError"))),
      },
      configurable: true,
    });
    render(<QrScanner onResult={vi.fn()} onBack={vi.fn()} />);
    expect(
      await screen.findByText(/couldn't find a camera/),
    ).toBeInTheDocument();
  });

  it("retries without facingMode on OverconstrainedError, then opens", async () => {
    const stop = vi.fn();
    const fakeStream = {
      getTracks: () => [{ stop } as unknown as MediaStreamTrack],
    } as unknown as MediaStream;
    // First call (facingMode preference) over-constrains; the retry with no
    // facingMode succeeds, so a device with only a front camera still opens.
    const getUserMedia = vi
      .fn()
      .mockRejectedValueOnce(namedError("OverconstrainedError"))
      .mockResolvedValueOnce(fakeStream);
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia },
      configurable: true,
    });
    render(<QrScanner onResult={vi.fn()} onBack={vi.fn()} />);
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
    // The retry passes a plain `video: true` (no facingMode constraint).
    expect(getUserMedia).toHaveBeenLastCalledWith({ video: true });
    // No error message: the second open succeeded, so the scanner stays live.
    expect(screen.queryByText(/couldn't find a camera/)).toBeNull();
    expect(screen.queryByText(/Camera access is off/)).toBeNull();
  });
});

import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DemoScanner } from "./DemoScanner.tsx";

// The demo scanner simulates a successful scan: no camera, a brief beat, then it
// hands back the seeded peer link so the People > Scan flow works on one device.
describe("DemoScanner", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("resolves to the seeded demo peer link after the beat, once", () => {
    const onResult = vi.fn();
    render(<DemoScanner onResult={onResult} onBack={vi.fn()} />);

    // Nothing before the beat.
    expect(onResult).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(1200));
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith({ id: "demo-scan", key: "demo" });
  });

  it("shows the scanner chrome and a close control", () => {
    render(<DemoScanner onResult={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByText("Scan a code")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Close" }),
    ).toBeInTheDocument();
  });
});

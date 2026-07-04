import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { DemoWatermark } from "./DemoWatermark.tsx";

// The watermark self-gates on demo mode (doc 28 D): the App mounts it always, so it
// must render nothing outside the demo and the accent frame inside it.
describe("DemoWatermark", () => {
  it("renders nothing outside demo mode", () => {
    const { container } = render(<DemoWatermark active={false} />);
    expect(container.querySelector(".demo-watermark")).toBeNull();
  });

  it("draws the accent frame and the wordmark in demo mode", () => {
    const { container } = render(<DemoWatermark active={true} />);
    const frame = container.querySelector(".demo-watermark");
    expect(frame).not.toBeNull();
    // Purely visual: hidden from the a11y tree and never intercepting a tap.
    expect(frame?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector(".demo-watermark__mark")?.textContent).toBe(
      "Demo",
    );
  });
});

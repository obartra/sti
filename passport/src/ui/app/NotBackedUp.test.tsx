import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { NotBackedUp } from "./NotBackedUp.tsx";

const COPY = "Saved on this device. It backs up when you're online.";

describe("NotBackedUp", () => {
  it("shows the quiet marker while edits are pending", () => {
    render(<NotBackedUp pending={true} />);
    expect(screen.getByText(COPY)).toBeInTheDocument();
  });

  it("shows nothing once nothing is pending", () => {
    render(<NotBackedUp pending={false} />);
    expect(screen.queryByText(COPY)).toBeNull();
  });

  it("never shows in demo mode, even if pending is somehow set", () => {
    // In the demo there is no server to back up to, so the marker is meaningless
    // and must stay off regardless of the pending flag (doc 28).
    render(<NotBackedUp pending={true} demo={true} />);
    expect(screen.queryByText(COPY)).toBeNull();
  });
});

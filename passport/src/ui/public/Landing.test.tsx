import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Landing } from "./Landing.tsx";

// The way-back banner is the only behavior unique to Landing worth pinning: it is
// the logged-out viewer's path back to a status they asked to see.
describe("Landing requests banner", () => {
  it("stays hidden when this device has made no requests", () => {
    render(<Landing onRequests={vi.fn()} pendingCount={0} />);
    expect(
      screen.queryByText(/link[s]? you asked to see/i),
    ).not.toBeInTheDocument();
  });

  it("shows the count and opens the list when there are requests", () => {
    const onRequests = vi.fn();
    render(<Landing onRequests={onRequests} pendingCount={2} />);
    const entry = screen.getByText("2 links you asked to see");
    fireEvent.click(entry);
    expect(onRequests).toHaveBeenCalled();
  });

  it("reads as singular for one request", () => {
    render(<Landing onRequests={vi.fn()} pendingCount={1} />);
    expect(screen.getByText("1 link you asked to see")).toBeInTheDocument();
  });
});

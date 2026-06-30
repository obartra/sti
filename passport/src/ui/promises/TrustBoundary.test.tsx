import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { TrustBoundary } from "./TrustBoundary.tsx";

// The diagram is a visual index into the tested promises, so it must keep showing
// the whole blind-store spine: your phone, our server, a viewer, and the two
// labelled crossings between them. A regression that drops a node or a crossing
// would quietly weaken the picture the page leans on.
describe("TrustBoundary", () => {
  it("renders the three nodes of the spine", () => {
    render(<TrustBoundary />);
    for (const title of [
      "Your device",
      "Our server",
      "Someone you share with",
    ]) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
  });

  it("labels what crosses each gap in plain words", () => {
    render(<TrustBoundary />);
    expect(screen.getByText("encrypted")).toBeInTheDocument();
    expect(screen.getByText("what you shared")).toBeInTheDocument();
  });

  it("states the blind-store guarantee, that we hold only a locked copy", () => {
    render(<TrustBoundary />);
    expect(
      screen.getByText(/We only hold the locked copy\./),
    ).toBeInTheDocument();
  });
});

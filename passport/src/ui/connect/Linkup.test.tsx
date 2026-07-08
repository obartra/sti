// The linkup surface per phase (doc 25): the shown code, the honest pending and
// failed states, the camera fallback that keeps the show half alive, and the
// completion pair with its two lines (warm both-blue, neutral one-gray). The
// state machine is covered in useLinkupFlow.test; this pins the markup + values.
import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LinkupView, completionLine, type LinkupViewProps } from "./Linkup.tsx";

function view(over: Partial<LinkupViewProps> = {}) {
  const props: LinkupViewProps = {
    phase: { kind: "showing", url: "https://sti.care/a/x#k=y" },
    ownerBadge: "blue",
    scanStatus: "scanning",
    videoRef: createRef<HTMLVideoElement>(),
    onRetry: vi.fn(),
    onClose: vi.fn(),
    ...over,
  };
  return render(<LinkupView {...props} />);
}

describe("LinkupView", () => {
  it("shows my code and the one-line instruction while live", () => {
    view();
    expect(screen.getByTestId("lk-code")).toBeInTheDocument();
    expect(
      screen.getByText("Point cameras at each other's screens."),
    ).toBeInTheDocument();
  });

  it("keeps the show half alive when the camera is denied", () => {
    view({ scanStatus: "denied" });
    expect(screen.getByTestId("lk-code")).toBeInTheDocument();
    expect(screen.getByText(/camera access is off/i)).toBeInTheDocument();
  });

  it("is honest while the code is minting and when it failed", () => {
    view({ phase: { kind: "pending" } });
    expect(screen.getByText("Getting your code ready")).toBeInTheDocument();
    view({ phase: { kind: "failed" } });
    expect(screen.getByText(/we couldn't make your code/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });

  it("shows the completion pair, named or not", () => {
    view({
      phase: { kind: "linked", peer: { label: "Sam", badge: "blue" } },
    });
    expect(screen.getByText("You're connected.")).toBeInTheDocument();
    expect(screen.getByText("Sam")).toBeInTheDocument();
    expect(screen.getByText("You're both up to date.")).toBeInTheDocument();

    view({
      phase: { kind: "linked", peer: { label: "", badge: null } },
    });
    expect(screen.getByText("Them")).toBeInTheDocument();
  });
});

describe("completionLine", () => {
  it("is warm only when both badges are blue, neutral otherwise", () => {
    expect(completionLine("blue", "blue")).toBe("You're both up to date.");
    expect(completionLine("blue", "gray")).toBe(
      "Free testing is easy to find when you want it.",
    );
    expect(completionLine("gray", "blue")).toBe(
      "Free testing is easy to find when you want it.",
    );
    expect(completionLine("blue", null)).toBe(
      "Free testing is easy to find when you want it.",
    );
  });
});

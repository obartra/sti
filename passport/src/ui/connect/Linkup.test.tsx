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
    // data-url mirrors the QR payload so a headless test can read the screen
    // the way a camera would; drifting from the QR would break the e2e journeys.
    expect(screen.getByTestId("lk-code")).toHaveAttribute(
      "data-url",
      "https://sti.care/a/x#k=y",
    );
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

  it("shows every linked face, named or not", () => {
    view({
      phase: {
        kind: "linked",
        peers: [
          { key: "p1", label: "Sam", badge: "blue" },
          { key: "p2", label: "", badge: null },
        ],
        doorUrl: null,
      },
    });
    expect(screen.getByText("You're connected.")).toBeInTheDocument();
    expect(screen.getByText("Sam")).toBeInTheDocument();
    expect(screen.getByText("Them")).toBeInTheDocument();
  });

  it("shows the door code and its one quiet line while open", () => {
    view({
      phase: {
        kind: "linked",
        peers: [{ key: "p1", label: "Sam", badge: "blue" }],
        doorUrl: "https://sti.care/d#p=x",
      },
    });
    expect(screen.getByTestId("lk-door")).toHaveAttribute(
      "data-url",
      "https://sti.care/d#p=x",
    );
    expect(
      screen.getByText("While this is open, anyone who scans it joins you."),
    ).toBeInTheDocument();
  });
});

describe("completionLine", () => {
  const blue = { key: "a", label: "", badge: "blue" } as const;
  const gray = { key: "b", label: "", badge: "gray" } as const;
  const unknown = { key: "c", label: "", badge: null } as const;

  it("is warm only when every badge is blue, neutral otherwise", () => {
    expect(completionLine("blue", [blue])).toBe("You're all up to date.");
    expect(completionLine("blue", [blue, blue])).toBe("You're all up to date.");
    expect(completionLine("blue", [blue, gray])).toBe(
      "Free testing is easy to find when you want it.",
    );
    expect(completionLine("gray", [blue])).toBe(
      "Free testing is easy to find when you want it.",
    );
    expect(completionLine("blue", [unknown])).toBe(
      "Free testing is easy to find when you want it.",
    );
  });
});

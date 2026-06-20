import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { PauseBanner } from "./Home.pause.tsx";

describe("PauseBanner (clearance auto-pause)", () => {
  it("extending the clearance window calls onExtend (persisted, not local)", async () => {
    const user = userEvent.setup();
    const onExtend = vi.fn();
    render(
      <PauseBanner
        autoPaused
        clearBy={new Date("2026-06-27T00:00:00Z")}
        resume={undefined}
        onExtend={onExtend}
      />,
    );

    // Auto-pause shows "Status paused while you recover" + the extend control,
    // not a resume (it cannot be lifted before the guideline window).
    expect(
      screen.getByText("Status paused while you recover"),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /Keep paused longer/ }),
    );
    expect(onExtend).toHaveBeenCalledOnce();
  });

  it("a manual pause shows resume, not the clearance extend", () => {
    const resume = vi.fn();
    render(
      <PauseBanner
        autoPaused={false}
        clearBy={new Date("2026-06-27T00:00:00Z")}
        resume={resume}
        onExtend={undefined}
      />,
    );
    expect(screen.getByText("Status hidden")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Keep paused longer/ }),
    ).toBeNull();
  });
});

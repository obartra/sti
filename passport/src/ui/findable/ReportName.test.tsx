import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ReportName } from "./ReportName.tsx";

describe("ReportName", () => {
  it("submits the chosen reason and shows a thank-you", async () => {
    const user = userEvent.setup();
    const report = vi.fn(() => Promise.resolve());
    render(<ReportName name="rob1n" report={report} />);

    // The name is shown; submit is disabled until a reason is picked.
    expect(screen.getByText("rob1n")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send report/i })).toBeDisabled();

    await user.click(screen.getByRole("radio", { name: /slur or hate/i }));
    await user.click(screen.getByRole("button", { name: /send report/i }));

    expect(report).toHaveBeenCalledWith("slur");
    expect(
      await screen.findByText(/thanks for the report/i),
    ).toBeInTheDocument();
  });

  it("does not submit without a reason", () => {
    const report = vi.fn(() => Promise.resolve());
    render(<ReportName name="rob1n" report={report} />);
    // Button disabled with no selection; nothing is sent.
    expect(screen.getByRole("button", { name: /send report/i })).toBeDisabled();
    expect(report).not.toHaveBeenCalled();
  });

  it("surfaces an error and stays on the form when sending fails", async () => {
    const user = userEvent.setup();
    render(
      <ReportName
        name="rob1n"
        report={() => Promise.reject(new Error("boom"))}
      />,
    );
    await user.click(screen.getByRole("radio", { name: /spam/i }));
    await user.click(screen.getByRole("button", { name: /send report/i }));

    expect(
      await screen.findByText(/couldn't send the report/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/thanks for the report/i),
    ).not.toBeInTheDocument();
  });

  it("can be cancelled", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ReportName name="rob1n" report={vi.fn()} onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("offers exactly the fixed reason set", () => {
    render(<ReportName name="rob1n" report={vi.fn()} />);
    expect(screen.getAllByRole("radio")).toHaveLength(5);
    for (const label of [
      /pretending to be/i,
      /abusive or harassing/i,
      /slur or hate/i,
      /spam or a scam/i,
      /something else/i,
    ]) {
      expect(screen.getByRole("radio", { name: label })).toBeInTheDocument();
    }
  });
});

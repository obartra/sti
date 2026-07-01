import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Feedback } from "./Feedback.tsx";

describe("Feedback", () => {
  it("submits the chosen category and note, then shows a thank-you", async () => {
    const user = userEvent.setup();
    const submit = vi.fn(() => Promise.resolve());
    render(<Feedback submit={submit} />);

    // Send is disabled until a category is picked (the note is optional).
    expect(screen.getByRole("button", { name: /send/i })).toBeDisabled();

    await user.click(
      screen.getByRole("radio", { name: /something's broken/i }),
    );
    await user.type(
      screen.getByLabelText(/anything that helps/i),
      "  the share button does nothing  ",
    );
    await user.click(screen.getByRole("button", { name: /send/i }));

    // The note is trimmed before it is sent.
    expect(submit).toHaveBeenCalledWith(
      "broken",
      "the share button does nothing",
    );
    expect(await screen.findByText(/thanks/i)).toBeInTheDocument();
  });

  it("sends without a note", async () => {
    const user = userEvent.setup();
    const submit = vi.fn(() => Promise.resolve());
    render(<Feedback submit={submit} />);
    await user.click(screen.getByRole("radio", { name: /a safety concern/i }));
    await user.click(screen.getByRole("button", { name: /send/i }));
    expect(submit).toHaveBeenCalledWith("safety", "");
  });

  it("does not submit without a category", () => {
    const submit = vi.fn(() => Promise.resolve());
    render(<Feedback submit={submit} />);
    expect(screen.getByRole("button", { name: /send/i })).toBeDisabled();
    expect(submit).not.toHaveBeenCalled();
  });

  it("surfaces an error and stays on the form when sending fails", async () => {
    const user = userEvent.setup();
    render(<Feedback submit={() => Promise.reject(new Error("boom"))} />);
    await user.click(screen.getByRole("radio", { name: /something else/i }));
    await user.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByText(/couldn't send/i)).toBeInTheDocument();
    expect(screen.queryByText(/thanks/i)).not.toBeInTheDocument();
  });

  it("can be cancelled", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Feedback submit={vi.fn()} onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("offers exactly the fixed category set", () => {
    render(<Feedback submit={vi.fn()} />);
    expect(screen.getAllByRole("radio")).toHaveLength(4);
    for (const label of [
      /something's broken/i,
      /something's confusing/i,
      /a safety concern/i,
      /something else/i,
    ]) {
      expect(screen.getByRole("radio", { name: label })).toBeInTheDocument();
    }
  });
});

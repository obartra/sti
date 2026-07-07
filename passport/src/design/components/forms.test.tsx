import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { PasswordInput } from "./forms.tsx";

describe("PasswordInput", () => {
  it("hides the value by default and reveals it on toggle", async () => {
    render(
      <>
        <label htmlFor="pw">Password</label>
        <PasswordInput id="pw" defaultValue="hunter2-but-long" />
      </>,
    );
    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("type", "password");

    await userEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(input).toHaveAttribute("type", "text");

    await userEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(input).toHaveAttribute("type", "password");
  });

  it("keeps the toggle a sibling outside the input, never an overlay inside it", () => {
    // Password managers (1Password, Bitwarden, the browser's key icon) anchor
    // their fill buttons inside the input's box. The eye must live outside that
    // box: same flex row, positioned in normal flow, no absolute overlay.
    render(<PasswordInput aria-label="Password" defaultValue="x" />);
    const input = screen.getByLabelText("Password");
    const toggle = screen.getByRole("button", { name: "Show password" });
    expect(toggle.contains(input)).toBe(false);
    expect(input.contains(toggle)).toBe(false);
    expect(toggle.parentElement).toBe(input.parentElement);
    expect(toggle.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });

  it("disables the toggle together with the input", () => {
    render(<PasswordInput aria-label="Password" disabled />);
    expect(screen.getByLabelText("Password")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Show password" })).toBeDisabled();
  });

  it("does not submit the surrounding form when toggled", async () => {
    let submitted = false;
    render(
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitted = true;
        }}
      >
        <PasswordInput aria-label="Password" defaultValue="x" />
      </form>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(submitted).toBe(false);
  });
});

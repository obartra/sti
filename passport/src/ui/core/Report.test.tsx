import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { Report } from "./Report.tsx";
import { COPY } from "./Report.parts.tsx";

// The footer's on-passport switch keeps its title outside the Switch for the row
// layout, so the association runs through htmlFor/id: the visible title must name
// the checkbox for assistive tech and toggle it when tapped.
describe("Report on-passport toggle", () => {
  it("is named by its visible title and toggles from the words", async () => {
    render(<Report today={20000} />);
    const toggle = screen.getByLabelText(COPY.onPassportTitle);
    expect(toggle).toBeChecked();
    await userEvent.click(screen.getByText(COPY.onPassportTitle));
    expect(toggle).not.toBeChecked();
  });
});

describe("Report date field", () => {
  it("associates the 'Date tested' label with the date input", () => {
    render(<Report today={20000} />);
    const input = screen.getByLabelText(COPY.dateLabel);
    expect(input).toHaveAttribute("type", "date");
  });
});

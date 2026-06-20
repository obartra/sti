import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Notifications } from "./Notifications.tsx";

describe("Notifications privacy invariant", () => {
  it("never names a person in a notification (silent linking)", () => {
    render(<Notifications />);
    // The knock notification is contentless about who knocked.
    expect(
      screen.getByText("Someone with your link asked to see your status"),
    ).toBeInTheDocument();
    // No rendered text carries an @handle (the requester is never named).
    expect(screen.queryByText(/@\w/)).toBeNull();
  });
});

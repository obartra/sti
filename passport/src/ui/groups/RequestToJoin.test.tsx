import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { RequestToJoin } from "./RequestToJoin.tsx";

describe("RequestToJoin", () => {
  it("asks to join and shows the confirmation on 'requested'", async () => {
    const user = userEvent.setup();
    const onRequest = vi.fn().mockResolvedValue("requested");
    render(<RequestToJoin onRequest={onRequest} />);
    await user.type(screen.getByLabelText("Join a group by name"), "book_club");
    await user.click(screen.getByRole("button", { name: "Ask to join" }));
    expect(onRequest).toHaveBeenCalledWith("book_club");
    expect(await screen.findByText("We asked for you.")).toBeInTheDocument();
  });

  it("shows the uniform not-found line when the name does not resolve", async () => {
    const user = userEvent.setup();
    render(
      <RequestToJoin onRequest={vi.fn().mockResolvedValue("not-found")} />,
    );
    await user.type(screen.getByLabelText("Join a group by name"), "nope");
    await user.click(screen.getByRole("button", { name: "Ask to join" }));
    expect(
      await screen.findByText(/No public group by that name/),
    ).toBeInTheDocument();
  });
});

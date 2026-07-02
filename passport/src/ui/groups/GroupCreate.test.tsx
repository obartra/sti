import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { GroupCreate } from "./GroupCreate.tsx";
import type { CreateGroupResult } from "../../store/index.ts";

function setup(
  result: CreateGroupResult,
  hasName = false,
  check: () => Promise<"free" | "taken" | "error"> = () =>
    Promise.resolve("free"),
) {
  const onCreate = vi
    .fn()
    .mockResolvedValue({ result, groupId: "new-group-id" });
  const onCreated = vi.fn();
  render(
    <GroupCreate
      onCreate={onCreate}
      onCreated={onCreated}
      onCheckName={check}
      hasName={hasName}
    />,
  );
  return { onCreate, onCreated };
}

describe("GroupCreate", () => {
  it("disables the CTA until a valid name is entered", () => {
    setup("registered");
    expect(
      screen.getByRole("button", { name: "Create a group" }),
    ).toBeDisabled();
  });

  it("registered: creates a public group and navigates with the new id", async () => {
    const user = userEvent.setup();
    const { onCreate, onCreated } = setup("registered");
    await user.type(screen.getByLabelText("Group name"), "thursday_run");
    await screen.findByText("That name is free.");
    await user.click(screen.getByRole("button", { name: "Create a group" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith("new-group-id"));
    expect(onCreate).toHaveBeenCalledWith({
      handle: "thursday_run",
      visibility: "public",
      meetingKind: "recurring",
      identity: "anonymous",
    });
  });

  it("created: a private group navigates with no availability gate", async () => {
    const user = userEvent.setup();
    const { onCreate, onCreated } = setup("created");
    await user.click(screen.getByRole("tab", { name: "Invite only" }));
    await user.type(screen.getByLabelText("Group name"), "fern_house");
    await user.click(screen.getByRole("button", { name: "Create a group" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith("new-group-id"));
    expect(onCreate).toHaveBeenCalledWith({
      handle: "fern_house",
      visibility: "private",
      meetingKind: "recurring",
      identity: "anonymous",
    });
  });

  it("show-as-you: creates as main when the owner picks their name", async () => {
    const user = userEvent.setup();
    const { onCreate } = setup("created", true);
    await user.click(screen.getByRole("tab", { name: "Invite only" }));
    await user.type(screen.getByLabelText("Group name"), "fern_house");
    await user.click(screen.getByRole("tab", { name: "Your name" }));
    await user.click(screen.getByRole("button", { name: "Create a group" }));
    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({ identity: "main" }),
      ),
    );
  });

  it("hides the show-as-you choice when the owner has no name", () => {
    setup("created");
    expect(screen.queryByText("How you show up")).not.toBeInTheDocument();
  });

  it("unavailable: keeps the form and shows the taken-name message", async () => {
    const user = userEvent.setup();
    const { onCreated } = setup("unavailable");
    await user.type(screen.getByLabelText("Group name"), "thursday_run");
    await screen.findByText("That name is free.");
    await user.click(screen.getByRole("button", { name: "Create a group" }));
    await screen.findByText("That name isn't available. Try another.");
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("error: keeps the form and shows the create error", async () => {
    const user = userEvent.setup();
    const { onCreated } = setup("error");
    await user.type(screen.getByLabelText("Group name"), "thursday_run");
    await screen.findByText("That name is free.");
    await user.click(screen.getByRole("button", { name: "Create a group" }));
    await screen.findByText("Couldn't create the group. Try again.");
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("blocks submit while a public name reads taken", async () => {
    const user = userEvent.setup();
    setup("registered", false, () => Promise.resolve("taken"));
    await user.type(screen.getByLabelText("Group name"), "thursday_run");
    await screen.findByText("That name isn't available. Try another.");
    expect(
      screen.getByRole("button", { name: "Create a group" }),
    ).toBeDisabled();
  });
});

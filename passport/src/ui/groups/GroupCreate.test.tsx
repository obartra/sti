import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { GroupCreate } from "./GroupCreate.tsx";
import type { ContactRecord } from "../../store/accountBlob.ts";

function contact(id: string, label: string): ContactRecord {
  return {
    id,
    label,
    createdDay: 1,
    expiresAt: null,
    alias: { id, writeToken: "w", key: "k", isPublic: false },
  };
}

const contacts = [contact("a", "sam"), contact("b", "ari")];

describe("GroupCreate", () => {
  it("creates: name + ticked contacts, CTA disabled until a name", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    render(<GroupCreate contacts={contacts} onCreate={onCreate} />);

    expect(screen.getByText("Create a group")).toBeInTheDocument();
    const cta = screen.getByRole("button", { name: "Create group" });
    expect(cta).toBeDisabled();

    await user.type(screen.getByPlaceholderText(/Thursday group/), "Crew");
    await user.click(screen.getByRole("checkbox", { name: /Add sam/ }));
    expect(cta).toBeEnabled();
    await user.click(cta);

    expect(onCreate).toHaveBeenCalledWith("Crew", ["a"]);
  });

  it("edits: prefills name + members, saves the changed set", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    render(
      <GroupCreate
        contacts={contacts}
        existing={{ id: "c1", name: "Thursday crew", memberContactIds: ["a"] }}
        onCreate={onCreate}
      />,
    );

    // Edit mode: prefilled name, sam already a member, the CTA says Save.
    expect(screen.getByText("Edit group")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Thursday crew")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Add sam/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Add ari/ })).not.toBeChecked();

    // Add ari, then save: the full member set is reported.
    await user.click(screen.getByRole("checkbox", { name: /Add ari/ }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(onCreate).toHaveBeenCalledWith("Thursday crew", ["a", "b"]);
  });
});

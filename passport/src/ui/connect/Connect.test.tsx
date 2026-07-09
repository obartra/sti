import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Connect } from "./Connect.tsx";
import type { ContactRecord } from "../../store/accountBlob.ts";

function contact(id: string, label: string, createdDay: number): ContactRecord {
  return {
    id,
    label,
    createdDay,
    expiresAt: null,
    alias: { id, writeToken: "w", key: "k", isPublic: false },
  };
}

const contacts = [
  contact("a", "the gym one", 100),
  contact("b", "blue shirt", 98),
];

function setup(over: Partial<Parameters<typeof Connect>[0]> = {}) {
  const onToggleFave = vi.fn();
  const onRemoveContact = vi.fn();
  const onSetEncounterDay = vi.fn();
  render(
    <Connect
      contacts={contacts}
      nowDay={100}
      faves={new Set()}
      onToggleFave={onToggleFave}
      onRemoveContact={onRemoveContact}
      onSetEncounterDay={onSetEncounterDay}
      {...over}
    />,
  );
  return { onToggleFave, onRemoveContact, onSetEncounterDay };
}

describe("Connect", () => {
  it("lists contacts by their private label, newest first (no @handle)", () => {
    setup();
    expect(screen.getAllByText("the gym one").length).toBeGreaterThan(0);
    expect(screen.getByText("blue shirt")).toBeInTheDocument();
    // No cross-account handle is ever shown.
    expect(screen.queryByText(/^@/)).toBeNull();
  });

  it("shows a starred contact in the Faves section and unstars it", async () => {
    const user = userEvent.setup();
    const { onToggleFave } = setup({ faves: new Set(["a"]) });
    await user.click(
      screen.getByRole("button", { name: "Unstar the gym one" }),
    );
    expect(onToggleFave).toHaveBeenCalledWith("a");
  });

  it("deletes a linkup from its row menu (revokes the contact)", async () => {
    const user = userEvent.setup();
    const { onRemoveContact } = setup();
    await user.click(
      screen.getByRole("button", { name: "Options for blue shirt" }),
    );
    await user.click(screen.getByText("Delete connection"));
    expect(onRemoveContact).toHaveBeenCalledWith("b");
  });

  it("back-dates the encounter from the row menu (doc 25)", async () => {
    const user = userEvent.setup();
    const { onSetEncounterDay } = setup();
    await user.click(
      screen.getByRole("button", { name: "Options for blue shirt" }),
    );
    // The "Met on" date input defaults to the contact's current encounter day
    // (its createdDay, day 98 = 1970-04-09) and reports the picked epoch day.
    const input = screen.getByLabelText(/Met on/);
    expect(input).toHaveValue("1970-04-09");
    fireEvent.change(input, { target: { value: "1970-04-05" } });
    expect(onSetEncounterDay).toHaveBeenLastCalledWith("b", 94);
  });

  it("renders the groups slot between starred and the full contact list", () => {
    setup({ groupsSlot: <div>GROUPS SLOT</div> });
    const starred = screen.getByText("Starred");
    const groups = screen.getByText("GROUPS SLOT");
    const recent = screen.getByText("Recent connections");
    // Order top to bottom: starred, then groups, then the contact list.
    expect(starred.compareDocumentPosition(groups)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(groups.compareDocumentPosition(recent)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
});

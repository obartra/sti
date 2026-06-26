import { render, screen } from "@testing-library/react";
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
  render(
    <Connect
      contacts={contacts}
      nowDay={100}
      faves={new Set()}
      onToggleFave={onToggleFave}
      onRemoveContact={onRemoveContact}
      {...over}
    />,
  );
  return { onToggleFave, onRemoveContact };
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
});

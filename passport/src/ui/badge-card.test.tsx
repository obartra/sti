import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { BadgeCard } from "./badge-card.tsx";
import { avatarFor, avatarSrc, randomAvatar } from "../lib/avatars.ts";

test("blue renders the HIV-prevention headline and the handle", () => {
  render(
    <BadgeCard state="blue" labels={["hiv"]} identity={{ handle: "robin" }} />,
  );
  expect(screen.getByText("Tested & on HIV prevention")).toBeInTheDocument();
  expect(screen.getByText("@robin")).toBeInTheDocument();
});

test("a condoms-always route owns the headline", () => {
  render(
    <BadgeCard
      state="blue"
      labels={["condoms_always"]}
      identity={{ handle: "sam" }}
    />,
  );
  expect(screen.getByText("Tested & always uses condoms")).toBeInTheDocument();
});

test("gray renders only the neutral line", () => {
  render(<BadgeCard state="gray" identity={{ handle: "alex" }} />);
  expect(screen.getByText("No status shared right now")).toBeInTheDocument();
});

test("gray-nothing (no identity) shows no handle", () => {
  render(<BadgeCard state="gray" identity={null} />);
  expect(screen.getByText("No status shared right now")).toBeInTheDocument();
  expect(screen.queryByText(/^@/)).toBeNull();
});

test("with no avatarSrc, the card falls back to the handle-derived avatar", () => {
  // The pre-avatar behavior (and what a v1 card resolves to): no avatarSrc means
  // the rendered avatar is deterministic from the handle.
  const { container } = render(
    <BadgeCard state="blue" labels={["hiv"]} identity={{ handle: "robin" }} />,
  );
  const img = container.querySelector(".sti-avatar img");
  expect(img?.getAttribute("src")).toBe(avatarFor("robin"));
});

test("a provided avatarSrc (the owner's chosen avatar) overrides the fallback", () => {
  const chosen = avatarSrc(randomAvatar(7));
  const { container } = render(
    <BadgeCard
      state="blue"
      labels={["hiv"]}
      identity={{ handle: "robin" }}
      avatarSrc={chosen}
    />,
  );
  const img = container.querySelector(".sti-avatar img");
  expect(img?.getAttribute("src")).toBe(chosen);
  expect(img?.getAttribute("src")).not.toBe(avatarFor("robin"));
});

import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { BadgeCard } from "./badge-card.tsx";
import { blueEligible } from "../core/badge.fixtures.ts";

test("a blue owner renders the route headline", () => {
  render(<BadgeCard owner={blueEligible()} />);
  const card = screen.getByLabelText("passport badge");
  expect(card).toHaveAttribute("data-badge", "blue");
  expect(screen.getByText("Tested & on HIV prevention")).toBeInTheDocument();
});

test("a gray owner renders only the neutral line", () => {
  render(<BadgeCard owner={{ ...blueEligible(), paused: true }} />);
  const card = screen.getByLabelText("passport badge");
  expect(card).toHaveAttribute("data-badge", "gray");
  expect(screen.getByText("No status shared right now")).toBeInTheDocument();
});

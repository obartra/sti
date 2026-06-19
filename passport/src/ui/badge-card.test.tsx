import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { BadgeCard } from "./badge-card.tsx";

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

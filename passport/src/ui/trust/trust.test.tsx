import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { LegalPage } from "./LegalPage.tsx";
import { TrustFooter } from "./TrustFooter.tsx";
import { TrustPage } from "./TrustPage.tsx";
import { PRIVACY_POLICY, TERMS } from "./trustCopy.ts";

describe("LegalPage", () => {
  it("renders the doc title, lead, and every block heading", () => {
    render(<LegalPage doc={PRIVACY_POLICY} />);
    expect(
      screen.getByRole("heading", { level: 1, name: PRIVACY_POLICY.title }),
    ).toBeInTheDocument();
    for (const block of PRIVACY_POLICY.blocks) {
      expect(
        screen.getByRole("heading", { level: 2, name: block.heading }),
      ).toBeInTheDocument();
    }
  });

  it("renders the terms doc too", () => {
    render(<LegalPage doc={TERMS} />);
    expect(screen.getByText(/not a medical test/i)).toBeInTheDocument();
  });
});

describe("TrustFooter", () => {
  it("routes each link to its handler", async () => {
    const onPromises = vi.fn();
    const onPrivacy = vi.fn();
    const onTerms = vi.fn();
    render(
      <TrustFooter
        onPromises={onPromises}
        onPrivacy={onPrivacy}
        onTerms={onTerms}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Our promises" }));
    await userEvent.click(screen.getByRole("button", { name: "Privacy" }));
    await userEvent.click(screen.getByRole("button", { name: "Terms" }));
    expect(onPromises).toHaveBeenCalledOnce();
    expect(onPrivacy).toHaveBeenCalledOnce();
    expect(onTerms).toHaveBeenCalledOnce();
  });
});

describe("TrustPage", () => {
  it("shows a back control that calls onBack, and renders the footer", async () => {
    const onBack = vi.fn();
    render(
      <TrustPage onBack={onBack}>
        <p>page body</p>
      </TrustPage>,
    );
    expect(screen.getByText("page body")).toBeInTheDocument();
    // The footer is present (its links render).
    expect(
      screen.getByRole("button", { name: "Our promises" }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("omits the back control when no onBack is given", () => {
    render(
      <TrustPage>
        <p>body</p>
      </TrustPage>,
    );
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
  });
});

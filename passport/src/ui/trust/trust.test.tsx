import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { LegalPage } from "./LegalPage.tsx";
import { TrustFooter } from "./TrustFooter.tsx";
import { TrustPage } from "./TrustPage.tsx";
import { PRIVACY_POLICY, TERMS } from "./trustCopy.ts";
import { footerLinks } from "../app/screens/trustScreens.tsx";
import { isScreen, type Screen } from "../app/routes.ts";
import type { Nav } from "../app/useAppRouter.ts";

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

  it("shows the page-level note that the full text is what applies", () => {
    render(<LegalPage doc={PRIVACY_POLICY} />);
    expect(screen.getByText(PRIVACY_POLICY.summaryNote)).toBeInTheDocument();
  });

  it("layers a plain summary on top of every section's binding text", () => {
    // The layered notice (doc 23) keeps both: a plain summary AND the full binding
    // text. A summary that replaced the terms would undermine enforceability, so we
    // pin that each block renders its summary and still renders its binding prose.
    render(<LegalPage doc={PRIVACY_POLICY} />);
    for (const block of PRIVACY_POLICY.blocks) {
      if (block.summary) {
        expect(screen.getByText(block.summary)).toBeInTheDocument();
      }
      for (const p of block.paragraphs ?? []) {
        expect(screen.getByText(p)).toBeInTheDocument();
      }
    }
  });

  it("renders the terms doc too, binding text intact", () => {
    render(<LegalPage doc={TERMS} />);
    expect(screen.getByText(/not a medical test/i)).toBeInTheDocument();
    for (const block of TERMS.blocks) {
      expect(
        screen.getByRole("heading", { level: 2, name: block.heading }),
      ).toBeInTheDocument();
    }
  });
});

describe("TrustFooter", () => {
  it("routes each link to its handler", async () => {
    const onPromises = vi.fn();
    const onPrivacy = vi.fn();
    const onTerms = vi.fn();
    const onShareLink = vi.fn();
    render(
      <TrustFooter
        onPromises={onPromises}
        onPrivacy={onPrivacy}
        onTerms={onTerms}
        onShareLink={onShareLink}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Our promises" }));
    await userEvent.click(screen.getByRole("button", { name: "Privacy" }));
    await userEvent.click(screen.getByRole("button", { name: "Terms" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Share your link" }),
    );
    expect(onPromises).toHaveBeenCalledOnce();
    expect(onPrivacy).toHaveBeenCalledOnce();
    expect(onTerms).toHaveBeenCalledOnce();
    expect(onShareLink).toHaveBeenCalledOnce();
  });

  it("omits the share-your-link button when no handler is given", () => {
    render(<TrustFooter onPromises={vi.fn()} />);
    expect(
      screen.queryByRole("button", { name: "Share your link" }),
    ).toBeNull();
  });

  it("offers a mailto feedback link to the published address", () => {
    render(<TrustFooter />);
    const link = screen.getByRole("link", { name: "Email us" });
    expect(link).toHaveAttribute(
      "href",
      expect.stringContaining("mailto:privacy@sti.care"),
    );
  });
});

describe("footerLinks", () => {
  it("routes each footer link to a real screen id (G16)", () => {
    // The trust footer must navigate to screens that actually exist; a typo'd target
    // (e.g. "privacy_policy" or "promise") would route nowhere. Pin both the exact
    // ids and that each one is in ALL_SCREENS, so a future rename keeps them honest.
    const go = vi.fn<(screen: Screen) => void>();
    const nav = { go, back: vi.fn(), jump: vi.fn() } as unknown as Nav;
    const links = footerLinks(nav);

    links.onPromises();
    links.onPrivacy();
    links.onTerms();
    links.onShareLink();

    const targets = go.mock.calls.map((c) => c[0]);
    expect(targets).toEqual([
      "promises",
      "privacy-policy",
      "terms",
      "share-link",
    ]);
    for (const target of targets) {
      expect(isScreen(target), `${target} is not a real screen`).toBe(true);
    }
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

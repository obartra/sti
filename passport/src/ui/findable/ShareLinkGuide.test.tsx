import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ShareLinkGuide } from "./ShareLinkGuide.tsx";
import { ShareLinkPage } from "./ShareLinkPage.tsx";
import {
  SHARE_LINK_GUIDE,
  publicLinkFor,
  publicHttpsLinkFor,
  SAMPLE_HANDLE,
  BIO_MOCKS,
} from "./shareLinkGuideCopy.ts";

describe("ShareLinkGuide", () => {
  it("shows the owner's real public link built from the handle", () => {
    render(<ShareLinkGuide handle="robin" />);
    expect(screen.getAllByText(publicLinkFor("robin")).length).toBeGreaterThan(
      0,
    );
  });

  it("copies the full https link to the clipboard on one tap", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(<ShareLinkGuide handle="robin" />);
    await userEvent.click(screen.getByRole("button", { name: /copy link/i }));
    expect(writeText).toHaveBeenCalledWith(publicHttpsLinkFor("robin"));
    // It confirms the copy landed.
    expect(screen.getByText(SHARE_LINK_GUIDE.copied)).toBeInTheDocument();
  });

  it("states what a public bio link exposes, and offers the private alternative", () => {
    render(<ShareLinkGuide handle="robin" />);
    expect(screen.getByText(SHARE_LINK_GUIDE.exposes)).toBeInTheDocument();
    // The private-link alternative is always offered (never pushes everyone public).
    expect(screen.getByText(SHARE_LINK_GUIDE.alt)).toBeInTheDocument();
  });

  it("renders a bio placement for each mock, with the link highlighted", () => {
    render(<ShareLinkGuide handle="robin" />);
    for (const m of BIO_MOCKS) {
      expect(screen.getByText(m.surface)).toBeInTheDocument();
    }
    // The link appears in the link card and in every mock.
    expect(
      screen.getAllByText(publicLinkFor("robin")).length,
    ).toBeGreaterThanOrEqual(1 + BIO_MOCKS.length);
  });

  it("hides its own header when asked (the public page supplies one)", () => {
    const { rerender } = render(<ShareLinkGuide handle="robin" />);
    expect(
      screen.getByRole("heading", { name: SHARE_LINK_GUIDE.title }),
    ).toBeInTheDocument();
    rerender(<ShareLinkGuide handle="robin" showHeader={false} />);
    expect(
      screen.queryByRole("heading", { name: SHARE_LINK_GUIDE.title }),
    ).toBeNull();
  });
});

describe("ShareLinkPage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the sample handle, never a real account or status", () => {
    render(<ShareLinkPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: SHARE_LINK_GUIDE.title }),
    ).toBeInTheDocument();
    // The sample link is shown; no real status word is asserted anywhere.
    expect(
      within(document.body).getAllByText(publicLinkFor(SAMPLE_HANDLE)).length,
    ).toBeGreaterThan(0);
  });
});

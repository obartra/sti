import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AvatarEdit } from "./AvatarEdit.tsx";
import { AVATAR_CREDIT } from "../../lib/credits.ts";
import { DEFAULT_AVATAR } from "../../lib/avatars.ts";

// The Dylan avatar style is CC BY 4.0, which requires visible attribution wherever
// the work is used (doc 19, G17). The editor must surface the credit and link to the
// license, so a refactor that drops it fails here, not silently in production.
describe("AvatarEdit attribution", () => {
  it("shows the CC-BY credit text and links to the license URL", () => {
    render(
      <AvatarEdit
        config={DEFAULT_AVATAR}
        onChange={vi.fn()}
        onDone={vi.fn()}
      />,
    );

    // The license name (e.g. "CC BY 4.0") is the link text, pointing at the license.
    const link = screen.getByRole("link", { name: AVATAR_CREDIT.license });
    expect(link).toHaveAttribute("href", AVATAR_CREDIT.licenseUrl);

    // The creator is credited in the surrounding line (CC-BY attribution). The line
    // mixes text and the link, so match the <p> that directly holds the credit text.
    expect(
      screen.getByText(
        (content, el) =>
          el?.tagName === "P" && content.includes(AVATAR_CREDIT.creator),
      ),
    ).toBeInTheDocument();
  });
});

import { describe, it, expect } from "vitest";
import { encodeMatrix, clearCentre, svgString } from "./qr.tsx";

// NOTE: these pin the encoder's structural contract (real QR geometry +
// determinism). End-to-end scannability (a phone camera actually reading the
// code and opening the link) cannot be exercised in jsdom; it relies on the
// vetted qrcode-generator library and needs a manual scan check before ship.

const LINK = `https://sti.care/a/${"z".repeat(43)}#k=${"a".repeat(43)}`;

describe("encodeMatrix", () => {
  it("produces a square grid sized to a valid QR version", () => {
    const grid = encodeMatrix(LINK);
    const n = grid.length;
    expect(n).toBeGreaterThanOrEqual(21); // version 1 is the smallest
    expect((n - 17) % 4).toBe(0); // n = 4*version + 17
    expect(grid.every((row) => row.length === n)).toBe(true);
  });

  it("is deterministic: the same link encodes to the same grid", () => {
    expect(encodeMatrix(LINK)).toEqual(encodeMatrix(LINK));
  });

  it("encodes the data: links differing only in the key differ in the grid", () => {
    const other = `https://sti.care/a/${"z".repeat(43)}#k=${"b".repeat(43)}`;
    expect(encodeMatrix(LINK)).not.toEqual(encodeMatrix(other));
  });

  it("lays down the top-left finder pattern (proves it is a real QR)", () => {
    const grid = encodeMatrix(LINK);
    // 7x7 finder: solid outer ring, a light ring inside it, a 3x3 dark core.
    for (let k = 0; k <= 6; k++) {
      expect(grid[0]?.[k]).toBe(true); // top edge of the ring
      expect(grid[6]?.[k]).toBe(true); // bottom edge of the ring
    }
    expect(grid[1]?.[1]).toBe(false); // light ring
    expect(grid[3]?.[3]).toBe(true); // centre of the 3x3 core
    expect(grid[0]?.[7]).toBe(false); // separator past the finder
  });
});

describe("clearCentre", () => {
  it("clears a centred square and leaves the corners (finders) intact", () => {
    const grid = encodeMatrix(LINK);
    const n = grid.length;
    const hole = 7;
    const cleared = clearCentre(grid, hole);
    const start = Math.floor((n - hole) / 2);
    // The whole hole is light...
    for (let i = start; i < start + hole; i++)
      for (let j = start; j < start + hole; j++)
        expect(cleared[i]?.[j]).toBe(false);
    // ...and the top-left finder is untouched.
    expect(cleared[0]?.[0]).toBe(true);
    expect(cleared[3]?.[3]).toBe(true);
  });

  it("returns the grid unchanged when the hole is not positive", () => {
    const grid = encodeMatrix(LINK);
    expect(clearCentre(grid, 0)).toBe(grid);
  });
});

describe("svgString", () => {
  const TEAL_LOGO = "#2F9BB3"; // the brand mark drawn into the decorative centre

  it("with a link, exports a real QR and no occluding centre logo", () => {
    const svg = svgString("logo", "a7f3k9q2", 1024, LINK);
    expect(svg).toContain("<rect"); // modules are present
    expect(svg).not.toContain(TEAL_LOGO); // nothing punched over the data
  });

  it("without a link, keeps the decorative centre brand mark", () => {
    const svg = svgString("logo", "a7f3k9q2", 1024);
    expect(svg).toContain(TEAL_LOGO);
  });
});

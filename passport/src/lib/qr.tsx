/* StiQR. encodeMatrix produces a REAL, scannable QR module grid for a URL (doc
   16): a phone camera scanning it opens the link. buildMatrix below is the older
   decorative faux matrix (real finder patterns, timing rows, separators, a
   reserved center hole), kept for the no-link Storybook/preview case where there
   is no URL to encode. Decorative and real share the same <rect> rendering. */
import { useMemo } from "react";
import type { CSSProperties, ReactElement } from "react";
import qrcode from "qrcode-generator";

// ── Real, scannable QR encoding (doc 16) ────────────────────────────────────
export type Ecc = "L" | "M" | "Q" | "H";

// Encode `value` (a full https link) into a real QR module grid. The grid side
// (and thus QR version) is chosen automatically from the data length. Error
// correction defaults to H (~30% recoverable), which keeps it scannable even
// with a center badge/logo punched out.
export function encodeMatrix(value: string, ecc: Ecc = "H"): boolean[][] {
  const qr = qrcode(0, ecc);
  qr.addData(value);
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) =>
    Array.from({ length: n }, (_, c) => qr.isDark(r, c)),
  );
}

// Clear a centerd square of `hole` modules (set them light) so a logo/badge can
// sit there. Returns a copy; the original is untouched. At ECC H a modest hole
// stays within the recoverable budget. A hole <= 0 returns the grid unchanged.
export function clearCenter(grid: boolean[][], hole: number): boolean[][] {
  if (hole <= 0) return grid;
  const n = grid.length;
  const start = Math.floor((n - hole) / 2);
  return grid.map((row, i) =>
    row.map((v, j) =>
      i >= start && i < start + hole && j >= start && j < start + hole
        ? false
        : v,
    ),
  );
}

// Small, stable PRNG so a given seed always paints the same code.
function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// The two parallel grids built up while laying out a code: m holds the painted
// modules, res marks which modules are reserved (function patterns), n is the
// side length in modules.
interface Grid {
  m: boolean[][];
  res: boolean[][];
  n: number;
}

// One module of a finder pattern: true when it sits on the 7×7 border or in
// the 3×3 core, given offsets (i, j) relative to the pattern's origin.
function finderModule(i: number, j: number): boolean {
  const border =
    (i >= 0 && i <= 6 && (j === 0 || j === 6)) ||
    (j >= 0 && j <= 6 && (i === 0 || i === 6));
  const core = i >= 2 && i <= 4 && j >= 2 && j <= 4;
  return border || core;
}

// Paint a single 7×7 finder pattern (with its 1-module separator) anchored at
// (r, c), marking each touched module as reserved.
function placeFinder(grid: Grid, r: number, c: number): void {
  const { m, res, n } = grid;
  for (let i = -1; i <= 7; i++)
    for (let j = -1; j <= 7; j++) {
      const rr = r + i,
        cc = c + j;
      if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
      const resRow = res[rr];
      const mRow = m[rr];
      if (resRow === undefined || mRow === undefined) continue;
      resRow[cc] = true;
      mRow[cc] = finderModule(i, j);
    }
}

// All three finder patterns (top-left, top-right, bottom-left).
function placeFinders(grid: Grid): void {
  const { n } = grid;
  placeFinder(grid, 0, 0);
  placeFinder(grid, 0, n - 7);
  placeFinder(grid, n - 7, 0);
}

// Timing patterns: alternating modules along row 6 and column 6.
function placeTiming(m: boolean[][], res: boolean[][], n: number): void {
  const res6 = res[6];
  const m6 = m[6];
  for (let i = 0; i < n; i++) {
    if (res6 !== undefined && m6 !== undefined && !res6[i]) {
      m6[i] = i % 2 === 0;
      res6[i] = true;
    }
    const resRow = res[i];
    const mRow = m[i];
    if (resRow !== undefined && mRow !== undefined && !resRow[6]) {
      mRow[6] = i % 2 === 0;
      resRow[6] = true;
    }
  }
}

// A small alignment block near the bottom-right (looks right on v2+ codes).
function placeAlignment(m: boolean[][], res: boolean[][], n: number): void {
  const a = n - 9;
  for (let i = -2; i <= 2; i++)
    for (let j = -2; j <= 2; j++) {
      const rr = a + i,
        cc = a + j;
      if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
      const resRow = res[rr];
      const mRow = m[rr];
      if (resRow === undefined || mRow === undefined) continue;
      resRow[cc] = true;
      mRow[cc] = Math.max(Math.abs(i), Math.abs(j)) !== 1;
    }
}

// Reserve the center hole (+1 module of quiet around it) and clear it.
function reserveHole(
  m: boolean[][],
  res: boolean[][],
  n: number,
  hole: number,
): void {
  const c0 = Math.floor((n - hole) / 2);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      if (
        i >= c0 - 1 &&
        i < c0 + hole + 1 &&
        j >= c0 - 1 &&
        j < c0 + hole + 1
      ) {
        const resRow = res[i];
        const mRow = m[i];
        if (resRow === undefined || mRow === undefined) continue;
        resRow[j] = true;
        mRow[j] = false;
      }
    }
}

// Fill every still-free module with deterministic pseudo-random data.
function fillData(
  m: boolean[][],
  res: boolean[][],
  n: number,
  seed: number,
): void {
  const rand = rng(seed);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const resRow = res[i];
      const mRow = m[i];
      if (resRow === undefined || mRow === undefined) continue;
      if (!resRow[j]) mRow[j] = rand() < 0.46;
    }
}

// Build an n×n boolean module grid. hole = side (in modules) of the cleared
// center square reserved for a badge.
export function buildMatrix(
  n: number,
  seed: number,
  hole: number,
): boolean[][] {
  const m: boolean[][] = Array.from({ length: n }, () =>
    Array<boolean>(n).fill(false),
  );
  const res: boolean[][] = Array.from({ length: n }, () =>
    Array<boolean>(n).fill(false),
  );
  placeFinders({ m, res, n });
  placeTiming(m, res, n);
  placeAlignment(m, res, n);
  reserveHole(m, res, n, hole);
  fillData(m, res, n, seed);
  return m;
}

// Hash a string → stable seed so each handle paints a distinct code.
export function seedOf(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface MatrixProps {
  size?: number | undefined;
  n?: number | undefined;
  hole?: number | undefined;
  color?: string | undefined;
  seed?: number | string | undefined;
  bg?: string | undefined;
  radius?: CSSProperties["borderRadius"] | undefined;
  /** When set, render a REAL scannable QR of this value (a full https link)
   * instead of the decorative faux matrix. The module count comes from the data,
   * so `n` is ignored; `hole` still clears a center square for a badge/logo. */
  value?: string | undefined;
}

// Pixel geometry shared by the module-drawing helpers: quiet-zone margin in
// modules, the module size, and the hairline gap inset.
interface RectLayout {
  quiet: number;
  cell: number;
  g: number;
}

// Turn a module grid into the array of <rect> elements (one per filled
// module), positioned within the quiet-zone margin.
function matrixRects(
  m: boolean[][],
  n: number,
  layout: RectLayout,
  color: string,
): ReactElement[] {
  const { quiet, cell, g } = layout;
  const rects: ReactElement[] = [];
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const mRow = m[i];
      if (!mRow?.[j]) continue;
      rects.push(
        <rect
          key={`${i}_${j}`}
          x={(quiet + j) * cell + g}
          y={(quiet + i) * cell + g}
          width={cell - g * 2}
          height={cell - g * 2}
          rx={cell * 0.18}
          fill={color}
        />,
      );
    }
  return rects;
}

// Resolve a Matrix seed prop into a numeric seed: a number passes through, a
// string (or missing/empty value) is hashed, defaulting to the "alias" seed.
function resolveSeed(seed: number | string | undefined): number {
  if (typeof seed === "number") return seed;
  return seedOf(seed === undefined || seed === "" ? "alias" : seed);
}

// Matrix({ size, value | seed, hole, color, bg }) → an <svg> of crisp modules.
// With `value` it is a real scannable QR of that link; otherwise the decorative
// faux matrix seeded by `seed`.
export function Matrix(props: MatrixProps): ReactElement {
  const size = props.size ?? 160;
  const hole = props.hole ?? 0;
  const color = props.color ?? "var(--ink-900)";
  const { value, seed: seedProp, n: nProp } = props;
  const m = useMemo(
    () =>
      value !== undefined && value !== ""
        ? clearCenter(encodeMatrix(value), hole)
        : buildMatrix(nProp ?? 29, resolveSeed(seedProp), hole),
    [value, nProp, seedProp, hole],
  );
  const n = m.length;
  const quiet = 2; // modules of margin
  const total = n + quiet * 2;
  const cell = size / total;
  const g = cell * 0.07; // hairline gap so modules read individually
  const rects = matrixRects(m, n, { quiet, cell, g }, color);
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{
        display: "block",
        background:
          props.bg === undefined || props.bg === "" ? "transparent" : props.bg,
        borderRadius: props.radius ?? 0,
      }}
      shapeRendering="geometricPrecision"
      role="img"
      aria-label="QR code"
    >
      {rects}
    </svg>
  );
}

// ── Export a scannable-looking status QR as a downloadable PNG ──────────────
// Builds a self-contained SVG (matrix + centered badge), rasterizes it to a
// crisp white-background PNG, and triggers a download. The center badge uses
// the two-state vocabulary only (blue in-window ring / gray dash), never a
// checkmark and never a four-light color.
const BADGE_HEX: Record<string, { base: string; bg: string }> = {
  blue: { base: "#2F9BB3", bg: "#DDF0F4" },
  gray: { base: "#8A8A99", bg: "#EAEAEE" },
};
function glyphFor(status: string, base: string): string {
  if (status === "gray") return '<line x1="15" y1="24" x2="33" y2="24"/>';
  // blue: neutral in-window ring + filled dot (not a tick)
  return `<circle cx="24" cy="24" r="11"/><circle cx="24" cy="24" r="4.6" fill="${base}" stroke="none"/>`;
}

// The brand mark, drawn into the QR center for a LINK-CARRIER export. It is
// pure branding (teal squircle + white verification check) and asserts NO
// status, used so a QR-carrier card image stays status-free.
function logoCenterSvg(size: number): string {
  const cx = size / 2,
    cy = size / 2;
  const knock = size * 0.205; // white knockout behind the mark
  const sq = size * 0.3; // teal squircle side
  const sb = size * 0.18; // check box side
  return (
    `<rect x="${(cx - knock).toFixed(1)}" y="${(cy - knock).toFixed(1)}" width="${(knock * 2).toFixed(1)}" height="${(knock * 2).toFixed(1)}" rx="${(knock * 0.42).toFixed(1)}" fill="#ffffff"/>` +
    `<rect x="${(cx - sq / 2).toFixed(1)}" y="${(cy - sq / 2).toFixed(1)}" width="${sq.toFixed(1)}" height="${sq.toFixed(1)}" rx="${(sq * 0.3).toFixed(1)}" fill="#2F9BB3"/>` +
    `<svg x="${(cx - sb / 2).toFixed(1)}" y="${(cy - sb / 2).toFixed(1)}" width="${sb.toFixed(1)}" height="${sb.toFixed(1)}" viewBox="0 0 48 48" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 25l7 7 13-16"/></svg>`
  );
}

// Serialize a module grid into an SVG <rect> string (one rect per filled
// module), each coordinate fixed to 2 decimals.
function matrixRectsSvg(
  m: boolean[][],
  n: number,
  layout: RectLayout,
  rx: number,
): string {
  const { quiet, cell, g } = layout;
  let rects = "";
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const mRow = m[i];
      if (!mRow?.[j]) continue;
      const x = (quiet + j) * cell + g,
        y = (quiet + i) * cell + g,
        w = cell - g * 2;
      rects += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${w.toFixed(2)}" rx="${rx.toFixed(2)}"/>`;
    }
  return rects;
}

// The two-state status badge drawn into the QR center (white knockout, colored
// ring, status glyph). Used for any status inside the two-state set.
function badgeCenterSvg(status: string, size: number): string {
  const cx = size / 2,
    cy = size / 2;
  const c = BADGE_HEX[status] ??
    BADGE_HEX.gray ?? { base: "#8A8A99", bg: "#EAEAEE" };
  const knock = size * 0.205; // white rounded knockout behind the badge
  const ring = size * 0.13; // colored circle radius
  const gb = size * 0.146; // glyph box side
  const glyph = glyphFor(status, c.base);
  return (
    `<rect x="${(cx - knock).toFixed(1)}" y="${(cy - knock).toFixed(1)}" width="${(knock * 2).toFixed(1)}" height="${(knock * 2).toFixed(1)}" rx="${(knock * 0.42).toFixed(1)}" fill="#ffffff"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${ring.toFixed(1)}" fill="${c.bg}" stroke="${c.base}" stroke-width="${(size * 0.013).toFixed(1)}"/>` +
    `<svg x="${(cx - gb / 2).toFixed(1)}" y="${(cy - gb / 2).toFixed(1)}" width="${gb.toFixed(1)}" height="${gb.toFixed(1)}" viewBox="0 0 48 48" fill="none" stroke="${c.base}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${glyph}</svg>`
  );
}

// svgString(status, seed, size, value?). With `value` it renders a REAL,
// scannable QR of that link, deliberately with NO center overlay so nothing
// occludes the modules (this is the image people actually scan). Without it,
// the decorative faux matrix carries a center badge/logo: "logo" (or anything
// outside the two-state set) draws the brand mark (link-carrier, asserts
// nothing), else the two-state status badge.
export function svgString(
  status: string,
  seed: string,
  size: number,
  value?: string,
): string {
  const quiet = 2;
  const real = value !== undefined && value !== "";
  const m = real ? encodeMatrix(value) : buildMatrix(29, seedOf(seed), 9);
  const n = m.length;
  const total = n + quiet * 2;
  const cell = size / total;
  const g = cell * 0.07;
  const rx = cell * 0.18;
  const rects = matrixRectsSvg(m, n, { quiet, cell, g }, rx);
  const isLogo = status === "logo" || !BADGE_HEX[status];
  const center = real
    ? ""
    : isLogo
      ? logoCenterSvg(size)
      : badgeCenterSvg(status, size);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<rect width="${size}" height="${size}" rx="${(size * 0.06).toFixed(1)}" fill="#ffffff"/>` +
    `<g fill="#1B1B2F">${rects}</g>` +
    center +
    `</svg>`
  );
}

export interface DownloadPNGOpts {
  status?: string | undefined;
  seed?: string | undefined;
  alias?: string | undefined;
  size?: number | undefined;
  /** The full link to encode as a REAL scannable QR. When set, the exported
   * image is a working QR of this URL (no center logo); without it the image is
   * the decorative faux matrix. The URL carries only the opaque id (+ key), never
   * a handle, so invariant 8 holds. */
  value?: string | undefined;
}

// downloadPNG({ status, value, seed | alias, size }) → triggers a PNG download.
// No `handle` parameter: a QR is only ever seeded/encoded from an opaque alias
// id (or a link built from one), never a handle.
export function downloadPNG(opts?: DownloadPNGOpts): void {
  const o = opts ?? {};
  // "logo" → a status-free link-carrier image; otherwise the two-state badge.
  const status = o.status ?? "blue";
  // Seed the (decorative) matrix by the opaque ALIAS id ONLY. The chain can
  // resolve to opts.seed or opts.alias (both opaque alias ids) and nothing else,
  // no opts.handle path, no "robin" literal, so a QR can never be seeded from a
  // human handle (invariant 8). If neither is supplied it falls to a neutral,
  // non-identifying placeholder, never a handle.
  const seed = o.seed ?? o.alias ?? "alias";
  // Download filename is derived from the opaque seed, never a handle.
  const fileTag = seed.replace(/[^a-z0-9]/gi, "") || "alias";
  const size = o.size ?? 1024;
  const svg = svgString(status, seed, size, o.value);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (ctx === null) {
      URL.revokeObjectURL(url);
      return;
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);
    URL.revokeObjectURL(url);
    canvas.toBlob((blob) => {
      if (blob === null) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `sti-passport-${fileTag}.png`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 0);
    }, "image/png");
  };
  img.onerror = () => URL.revokeObjectURL(url);
  img.src = url;
}

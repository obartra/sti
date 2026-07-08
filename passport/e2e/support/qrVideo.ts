// The camera fixture's video (doc 38 §3): render a URL as a QR code into a Y4M
// file that Chromium's fake capture device plays on a loop, standing in for the
// other person's phone screen. The module grid comes from the app's OWN encoder
// (src/lib/qr.tsx, the one every share surface uses, at its default ECC), so the
// video cannot drift from the product's encoding.
import { writeFileSync } from "node:fs";

import { encodeMatrix } from "../../src/lib/qr.tsx";

const WIDTH = 640; // even, for 4:2:0 chroma
const HEIGHT = 480;
const FRAMES = 10; // the capture loops the file; a few identical frames suffice
const WHITE = 235; // video-range luma
const BLACK = 16;
const QUIET = 4; // quiet-zone modules each side (the QR spec minimum)

export function writeQrVideo(text: string, filePath: string): void {
  const grid = encodeMatrix(text);
  const side = grid.length + QUIET * 2;
  const scale = Math.floor(Math.min(WIDTH, HEIGHT) / side);
  if (scale < 3) {
    throw new Error(
      `QR too dense for the fake camera frame (${grid.length} modules); shorten the URL`,
    );
  }
  const size = side * scale;
  const ox = Math.floor((WIDTH - size) / 2);
  const oy = Math.floor((HEIGHT - size) / 2);

  // One I420 frame: a white field with the QR's dark modules painted in luma;
  // both chroma planes stay neutral (gray), i.e. a black-and-white picture.
  const y = new Uint8Array(WIDTH * HEIGHT).fill(WHITE);
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r];
    if (row === undefined) continue;
    for (let c = 0; c < row.length; c++) {
      if (row[c] !== true) continue;
      const top = oy + (r + QUIET) * scale;
      const left = ox + (c + QUIET) * scale;
      for (let py = top; py < top + scale; py++) {
        y.fill(BLACK, py * WIDTH + left, py * WIDTH + left + scale);
      }
    }
  }
  const chroma = new Uint8Array((WIDTH / 2) * (HEIGHT / 2)).fill(128);

  const frame = Buffer.concat([
    Buffer.from("FRAME\n", "ascii"),
    Buffer.from(y),
    Buffer.from(chroma),
    Buffer.from(chroma),
  ]);
  const header = Buffer.from(
    `YUV4MPEG2 W${WIDTH} H${HEIGHT} F30:1 Ip A1:1 C420\n`,
    "ascii",
  );
  writeFileSync(
    filePath,
    Buffer.concat([header, ...Array.from({ length: FRAMES }, () => frame)]),
  );
}

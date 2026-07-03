# sti.care intro — assembly guide (stitch this and you're done)

Everything except the four generated shots is pre-built. Generate shots 1, 2, 3, 5 in
Gemini using the paste-ready files in `prompts/`, then drop everything on a timeline in the
order below. The finished clips (beats 4, 6, 7) and the text overlays are already typeset in
the brand fonts and colors, so there is no design work left, only stitching.

## What's in the kit

- `prompts/` — 8 paste-ready Gemini/Veo prompt files (4 shots x 16:9 and 9:16).
- `build/clips/` — finished animated clips, ready to place as-is:
  - `beat4-card-turns-blue--{16x9,9x16}.webm` (the blue card resolving, ~5.2s)
  - `beat6-values--{16x9,9x16}.webm` (the values line + teal hairline, ~3.8s)
  - `beat7-lockup--{16x9,9x16}.webm` (wordmark + CTA, ~4.6s)
- `build/overlays/` — transparent PNG text cards to lay over the generated footage:
  - `beat1-yours-to-share`, `beat2-encrypted`, `beat3a-encrypted-version`,
    `beat3b-cant-read`, `beat5-conversation` (each in `--16x9` and `--9x16`)
- `assets/` — the source logo SVGs and the real UI screens (for reference or extra beats).
- `music-prompt.txt` — paste into your music generator; export a 35s and an ~16s version.

Clips are WebM (VP8). CapCut, DaVinci Resolve, and current Premiere/FCP import them
directly. If your editor wants MP4, transcode locally with a standard ffmpeg:
`ffmpeg -i clip.webm -c:v libx264 -pix_fmt yuv420p -r 30 clip.mp4`

## Hero timeline (16:9, ~35s)

| # | Time | Video track | Text/overlay track | Notes |
|---|------|-------------|--------------------|-------|
| 1 | 0:00-0:03 | Gemini `shot1-cold-open--16x9` | `beat1-yours-to-share--16x9.png` | fade the overlay in over ~0.3s at 0:00.4 |
| 2 | 0:03-0:08 | Gemini `shot2-encryption--16x9` | `beat2-encrypted--16x9.png` | |
| 3 | 0:08-0:14 | Gemini `shot3-blind-store--16x9` | `beat3a-...` (0:08-0:11), then `beat3b-...` (0:11-0:14) | cross-fade the two overlays |
| 4 | 0:14-0:19 | `build/clips/beat4-card-turns-blue--16x9.webm` | (none; the card speaks) | chime lands ~0:15 with the teal bloom |
| 5 | 0:19-0:26 | Gemini `shot5-human-beat--16x9` | `beat5-conversation--16x9.png` | |
| 6 | 0:26-0:30 | `build/clips/beat6-values--16x9.webm` | (baked in) | |
| 7 | 0:30-0:34 | `build/clips/beat7-lockup--16x9.webm` | (baked in) | hold the final wordmark, music resolves |

Transitions: ~250ms cross-dissolves between beats (overlap the clips by ~6-8 frames at
25fps). No hard cuts on the beat, no flashes, no speed ramps. The warm backgrounds dissolve
cleanly into the generated footage.

Text overlay fades: bring each overlay up 0 -> 100% over ~250ms, hold, and let it dissolve
out with the shot. The overlays already carry a soft warm scrim for legibility, so no
drop-shadow or box is needed.

## Vertical cutdown (9:16, ~16-18s)

| # | Time | Video track | Text/overlay track |
|---|------|-------------|--------------------|
| 1 | 0:00-0:06 | `shot2-encryption--9x16` into `shot3-blind-store--9x16` | `beat3b-cant-read--9x16.png` |
| 2 | 0:06-0:11 | `build/clips/beat4-card-turns-blue--9x16.webm` | (none) |
| 3 | 0:11-0:14 | tail of `shot5-human-beat--9x16` | `beat5-conversation--9x16.png` |
| 4 | 0:14-0:18 | `build/clips/beat7-lockup--9x16.webm` | (baked in) |

## Audio

- One music track (from `music-prompt.txt`) under the whole piece.
- Optional: keep the Gemini shots' ambient audio low under the music (key taps, shimmer,
  room tone), or mute them and rely on the music alone.
- The one chime is at ~0:15 (hero) on the card bloom. If your music already includes the
  bell tone from the cue map, you do not need a separate chime.

## Quick QA before export
- Every caption reads calmly: sentence case, no em dashes, no exclamation points. (Baked in.)
- Nothing moves too fast; the whole thing should feel unhurried.
- Colors stay warm off-white / ink / one teal accent. No stray saturated color from a shot.
- The generated shots show no faces and no legible text. If one does, add it to that shot's
  AVOID line and regenerate.

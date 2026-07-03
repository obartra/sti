# sti.care intro video — generation kit (part two)

This turns the approved creative brief into ready-to-run Gemini/Veo prompts plus the
real assets to composite. Model target: Google's Gemini video generation (Veo family).

**How it assembles:** Veo generates the four abstract/gesture shots (beats 1, 2, 3, 5).
The card, wordmark, and any on-screen words are composited from real assets in an editor
(the Veo prompts deliberately render no faces and no legible text). Music is added in the
edit, not generated. See the asset manifest and edit plan at the bottom.

Everything here obeys the brand guardrails: warm and calm, no hype, no fear, sentence
case, no em dashes, no exclamation points, teal as an accent only.

---

## Global style block (prepend to every Veo shot prompt)

> Style: calm, warm, editorial, cinematic, minimalist. Soft natural daylight, gentle and
> unhurried. Shallow depth of field, 50mm look, subtle film grain. Color palette dominated
> by a warm off-white (#FBF9F4) with near-black navy ink tones (#1B1B2F) and a single calm
> teal accent (#2F9BB3); no other saturated colors, not dark, not neon. Motion is slow and
> understated, no fast moves, no bounce, no whip pans. Quiet, reassuring, intimate mood.

## Global negative prompt (append to every shot)

> Avoid: any visible human faces, recognizable people, text, captions, subtitles, UI text,
> app screenshots, logos, watermarks, brand marks, fast motion, camera shake, lens flares,
> neon, high saturation, dark or moody grading, clinical or hospital setting, stock-ad
> cheerfulness, dramatic lighting.

---

## SHOT 1 — cold open (beat 1, ~3s, 16:9 and 9:16)

**Prompt:**
> Extreme close-up of one hand holding a modern smartphone, a thumb slowly typing. Framed
> over the shoulder from a high angle so that no face is ever visible, only the hand and the
> phone. Cozy home interior softly blurred behind, warm morning daylight through a window
> just out of frame. The phone screen emits a soft glow but its content is abstract and
> indistinct, no readable interface. The camera pushes in a few centimeters, very slowly.
> Calm, private, unhurried. [Global style block] [Global negative prompt]
>
> Audio: soft key taps, quiet room tone, a distant bird. No music.

## SHOT 2 — encryption (beat 2, ~5s, 16:9 and 9:16)

**Prompt:**
> Macro shot of a smartphone screen resting in an open hand. Fine particles of luminous
> teal light (#2F9BB3) gently lift off the glass surface and drift upward, as though written
> marks are dissolving into weightless glowing dust. No readable text at any point, only the
> poetic transformation of soft glowing marks into rising, shimmering teal particles. Warm
> off-white surroundings far out of focus. Slow, airy, weightless motion. Cinematic macro,
> shallow depth of field. [Global style block] [Global negative prompt]
>
> Audio: a soft airy shimmer, quiet room tone. No music.

## SHOT 3 — the blind store (beat 3, ~6s, 16:9 and 9:16)

**Prompt:**
> Minimalist abstract scene in a calm, empty, warm off-white (#FBF9F4) space with soft
> studio light. A smooth matte monolithic form, a softly rounded standing slab in cool
> neutral gray, sits at center. A drifting cloud of glowing teal (#2F9BB3) particles floats
> toward the monolith and settles gently against its surface, but the monolith stays
> completely closed and seamless, no opening, no seam, revealing nothing and absorbing
> nothing. Serene and still. The camera drifts very slowly around it. Architectural,
> restrained, reassuring. [Global style block] [Global negative prompt]
>
> Audio: a low soft ambient hum, very quiet. No music.

## SHOT 5 — the ordinary human beat (beat 5, ~7s, 16:9; reframe for 9:16)

**Prompt:**
> Two people sitting close together on a couch in a warm, cozy living room at golden hour,
> filmed from chest height downward so that no faces are visible, only hands, laps,
> shoulders and relaxed body language. Each person holds up a smartphone toward the other's
> phone, the two screens facing each other as if quietly scanning. The screens glow softly,
> one with a gentle teal tone. An easy, comfortable, everyday moment, a slight relaxed
> lean-in, unhurried. Warm soft light, shallow depth of field, intimate but casual.
> [Global style block] [Global negative prompt]
>
> Audio: soft room tone, a quiet warm ambient, faint easy laughter off to the side. No music.

---

## Composited beats (no generation, real assets)

These use the real UI so the product reads true. Do not let Veo render them.

### BEAT 4 — the card turns blue (~6s) — HERO MOMENT
- Asset: `assets/screens/passport-badge-card--blue-on-hiv-prevention.png` (the clean blue
  card; headline reads "Tested & on HIV prevention" in the real product).
- Optional lead-in (~1.5s): `assets/screens/passport-core-report-a-result--report-form.png`
  or `--on-prep.png` to show the live "what blue needs" checklist before it resolves.
- Motion: the card fades and eases up ~12px over 250ms; the teal ring (Medallion) settles
  last. One soft chime lands exactly as the ring completes (the single earned delight).
- Do NOT overlay a headline here. The card carries its own; adding "Tested and on HIV
  prevention" would double it and clash with the card's ampersand.

### BEAT 6 — the values turn (~4s)
- Pure typography on warm off-white #FBF9F4.
- Line (Source Serif 4 SemiBold, ink #1B1B2F, sentence case), centered, fades up:
  **Only people you send a link to can find you.**
- Teal hairline (#2F9BB3, 1px) draws across beneath it to bridge into the lockup.

### BEAT 7 — logo lockup + CTA (~4s)
- Asset: `assets/logo/logo-wordmark.svg` (two-tone: "sti" #1B1B2F, ".care" #2F9BB3; teal
  tile with white ring mark). Draw it in via the teal hairline from beat 6.
- Line above (Source Serif 4 SemiBold, #1B1B2F): **Sexual health is health.**
- CTA settles below (Hanken Grotesk 600, #1B1B2F): **Create your own passport.**
- Hold on the clean wordmark on #FBF9F4. Music resolves on a quiet held chord.

---

## On-screen text (final, voice-guide-clean)

All Source Serif 4 SemiBold for display lines; sentence case; no em dashes.

| Beat | Timing (hero) | Line |
|------|---------------|------|
| 1 | 0.0 - 3.0s | Some things are yours to share. |
| 2 | 3.0 - 8.0s | It's encrypted on your phone before it leaves. |
| 3a | 8.0 - 11.0s | We only ever hold the encrypted version. |
| 3b | 11.0 - 14.0s | We can't read what you save. |
| 4 | 14.0 - 20.0s | (no overlay; the real card speaks) |
| 5 | 20.0 - 27.0s | Use it to start a conversation, not to skip one. |
| 6 | 27.0 - 31.0s | Only people you send a link to can find you. |
| 7 | 31.0 - 35.0s | Sexual health is health.  /  Create your own passport. |

Note: beat 3a uses "encrypted" (not "scrambled"). It's the more familiar, honest word and,
counterintuitively, reads as less cryptic; it also matches the voice guide's label swap.

---

## Music and sound

- One warm soft analog synth pad, slow (~70 bpm), no drum build, no drop. Enters under
  beat 2, swells almost imperceptibly through beat 4, settles by beat 6, resolves on a held
  chord at beat 7. Reassuring, not triumphant.
- Sound design: soft key taps (beat 1), airy shimmer (beat 2), low ambient hum (beat 3),
  one soft chime as the ring completes (beat 4), warm room tone and faint laughter (beat 5).
- Generate music separately (or license); do not rely on Veo's audio for the score. Keep
  Veo audio as ambient texture only, or mute it and use your own sound design.

## Transitions

- Cross-dissolves and gentle upward slides at ~250ms, ease-out (matches the app's motion).
- Recurring motif: a 1px teal hairline (#2F9BB3) drawing across to reveal the next beat.
- Respect the calm: no hard cuts on the beat, no flash frames, no speed ramps.

---

## 9:16 social cutdown (~15-18s)

Reframe subjects centered, keep text in the top-third safe area.
1. Beats 2 + 3 merged: type, particles rise, settle against the closed monolith. One line:
   **We can't read what you save.** (~6s)
2. Beat 4: the card turns blue, given the most room (~6s). Chime.
3. One line over a short tail of beat 5 gesture: **Use it to start a conversation, not to
   skip one.** (~3s)
4. Beat 7 lockup: wordmark + **Create your own passport.** (~3s)

---

## Asset manifest

Logos (`assets/logo/`):
- `logo-wordmark.svg` — primary two-tone lockup for beat 7 (light backgrounds).
- `logo-wordmark-light.svg` — variant for darker frames if needed.
- `logo-mark.svg`, `favicon.svg` — the ring mark alone (corner bug or the particle source
  motif if you want the encryption in beat 2 to resolve from the ring).

Real UI screens (`assets/screens/`), pixel-accurate, warm off-white ground:
- `passport-badge-card--blue-on-hiv-prevention.png` — HERO blue card (beat 4).
- `passport-badge-card--blue-hiv-and-condoms.png` — alt blue card (both routes).
- `passport-badge-card--gray-nothing.png` — the neutral gray state ("no status shared
  right now"), if you want to show gray before it turns blue.
- `passport-core-report-a-result--report-form.png` / `--on-prep.png` — the "what blue
  needs" checklist lead-in for beat 4.
- `passport-core-report-a-result--saved-blue.png` — full "result saved" screen (context).
- `passport-share-sheet--identity-anonymous.png` — the "pick a face" anonymous share, if
  you extend the cut.
- `passport-public-resolution--resolved-with-avatar.png` / `--link-holder-knock.png` — a
  partner opening a link / the silent-knock state, for an alternate beat 5.
- `passport-landing--default.png` — the real landing, optional end tag before the lockup.

Fonts to match the product exactly:
- Display: Source Serif 4 SemiBold (600).
- UI/CTA: Hanken Grotesk (600/700), letter-spacing -0.02em on the wordmark.

Exact colors (from `passport/src/design/tokens/colors.css`):
- Ground `#FBF9F4`, ink `#1B1B2F`, teal accent `#2F9BB3` (hover `#277F94`, deep `#1F6E80`),
  gray-state neutral `#8A8A99` / `#6C6C7A`.

---

## Pre-flight checklist (before spending generation credits)

1. Read every on-screen line aloud against the voice guide: calm, sentence case, no em
   dashes, no banned words (protected, safe, clean, cleared, screened, expired). Passes.
2. Confirm the wordmark two-tone and all hex against the token file and the logo SVGs.
3. Build a stills animatic first (these real screens + the timed text + a scratch synth
   pad) to lock pacing before generating the four Veo shots.
4. Generate shots 1, 2, 3, 5. Verify each renders no faces and no legible text; if any shot
   sneaks in a face or UI text, add it to that shot's negative prompt and re-roll.
5. Composite beats 4, 6, 7 from the real assets over the Veo footage. Add music and the
   single chime. Export 16:9 master, then cut the 9:16.

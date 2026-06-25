# sti.care: Voice and Tone

_The canonical guide for every word a user reads. If you write or change
user-facing copy (a screen, a button, an error, a notification, an empty state,
share/consent text), it follows this. Internal code, comments, and design docs are
out of scope; this is the product talking to a person._

---

## Who we're talking to

An adult managing their sexual health and sharing it with partners. Often in a
charged moment: a new result, meeting someone, deciding whether to trust an app
with something sensitive.

A positive result is not "bad news." Sexual health is health.

**Sex-positive and inclusive, as a value, not a banner.** The product is frankly
sex-positive and built for a wide, diverse audience. That shapes word choice and
assumptions: no shame, no moralizing, no assumptions about gender, orientation,
relationship structure, number of partners, or HIV status; plain, frank language
about bodies and sex when the screen calls for it (the testing flow already says
"dick, pussy, ass" rather than clinical euphemism, and that is right). But it is a
posture, not a slogan. Most screens never mention it. Don't perform inclusivity or
preach it; just write so that no one is othered and no one is judged. Bring it
forward only where it genuinely helps the reader, and otherwise let it sit quietly
under everything.

## Voice (constant)

The personality never changes, whatever the screen:

- **Plain.** Short words, short sentences. Say the thing. A reader who is anxious or
  distracted still gets it in one pass.
- **Calm and matter-of-fact.** Never alarmist, never clinical-cold, never moralizing.
- **Confident, and it trusts the reader.** We don't over-explain, over-reassure, or
  narrate the interface. We don't tell the reader what they're about to read.
- **Warm, not cute.** Human and respectful. No chirpy peppiness, no babytalk, no
  emoji-as-personality, no slang doing the work of a real sentence.
- **Honest.** Never overclaim, especially on privacy. State a real limit plainly. But
  honesty is not a confession: never describe how the system could be attacked.

## Tone (shifts with the moment)

The voice holds; the warmth dials up or down:

- **Onboarding / privacy:** grounded and specific. Earn trust with concrete plain
  facts, not adjectives.
- **Reporting a result, a positive, a partner alert:** steady and supportive. No
  drama, no pity, no euphemism. Practical next step.
- **Errors:** human and useful. What happened, and what to do. Never blame the user,
  never a dead end.
- **Sharing / connecting:** light and frictionless, not flippant.

## Register and complexity

- Conversational but adult. Not legal, not clinical, not marketing-hype, not casual-
  to-the-point-of-cute.
- Aim for a ~6th-to-8th-grade reading level. One idea per sentence. Cut qualifiers.
- Active voice: "we can't read it", not "it cannot be read". "you choose who sees
  it", not "access is granted by the owner".

## Hard rules

1. **No preamble or meta.** Don't say "this is what this means", "plain-English
   guarantees", "(a nickname)", "(from Connect)", "Visitor preview. This is exactly
   what others see." Just say the thing, or just show the field.
2. **No internal jargon in user copy.** The user never sees our implementation words.
   See the vocabulary table below.
3. **Lead with the user's outcome, not our mechanism.** "No one can look you up" beats
   "there is no directory endpoint."
4. **Don't pile up negations.** One clear positive beats three "no / never / can't"
   clauses. "Only people you send a link to can see you" beats "No directory, no
   search, a stranger can't look you up."
5. **Sentence case everywhere**, including headers and buttons. No Title Case.
6. **Buttons are verbs that name the outcome.** "Share my status", "Get tested",
   "Delete everything." Not "Submit", not "OK".
7. **"and", not "&"**, in copy.
8. **No exclamation points** unless the delight is real and rare.
9. **No em dashes** (house rule, everywhere). Restructure: comma, period, parentheses,
   "because", "so".
10. **Health copy is never alarmist or stigmatizing.** "treatable" not "gets worse over
    time"; "a painless sore that is easy to miss" only if it leads to "so test for it",
    never as a scare.
11. **Honesty without a target list.** State what is protected ("we can't read it",
    "the server never learns who was notified"), not the channel an attacker would
    probe.

## Vocabulary: say this, not that

The user never sees our internal nouns. (Keep "passport"; it is the product, and the
metaphor is good.)

| Internal / off-voice           | User-facing                                        |
| ------------------------------ | -------------------------------------------------- |
| alias                          | link, or profile (by context)                      |
| linkup                         | connection                                         |
| knock (noun) / knocking        | request to see your status / ask                   |
| findable / vanity name         | public name                                        |
| capability, pairwise reference | (drop; describe the outcome)                       |
| decoy, resolves, resolving     | (drop; "the link stops working", "nothing shows")  |
| unlinkable                     | can't be connected to each other or to you         |
| scrambled                      | encrypted                                          |
| faves                          | starred                                            |
| crew, a night                  | group, event                                       |
| no buzz, no push               | silent                                             |
| the move, green light, a tally | (drop the slang; say it straight)                  |

**Frank words for bodies and sex are not on this list.** "dick", "pussy", "ass",
"sex", and the like are the correct, inclusive words in a sex-positive health
product; keep them where the screen calls for it (the testing flow uses them, and
that is right). The "no slang / not cute" rule targets lazy fillers that stand in for
a real sentence ("the move", "green light", "faves", "crew"), never plain sexual or
anatomical language. Don't sanitize into clinical euphemism.

## Before / after

- "Plain-English guarantees about your privacy. Open any promise to see exactly what
  we check." -> "Each one is backed by a test that fails our build the moment it stops
  being true." (cut the preamble; say the one real thing)
- "Everything is scrambled on your phone before it is sent. Our servers only ever hold
  the scrambled version, and even our own admin tools can't unlock it." -> "It's
  encrypted on your phone before it's sent, and we only ever hold the encrypted
  version. We can't read it." (plain word, drop the flourish)
- "No directory, no @-search, a stranger can't look you up." -> "Only people you send a
  link to can find you." (one positive, not three negatives)
- "Asking the server to wake a device does identical work whether or not the device is
  known, so the timing reveals nothing." -> "The server can't tell a real alert from
  noise, so it never learns who was notified." (state the protection, not the channel)
- "No circles yet. Create one for your crew, your house, or a night." -> "No circles
  yet. Create one for a group, a household, or an event." (drop the slang)

## When in doubt

Read it aloud. If it sounds like a brochure, a lawyer, a hospital intake form, or a
hype tweet, rewrite it. If a worried person would understand it on the first read and
feel calmer, it is right.

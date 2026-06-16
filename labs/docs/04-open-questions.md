# Open questions

_Reviewed for consistency: June 15, 2026. Reflects the feature-complete build._

*The honest calls I don't want to make alone. The first part is a quick description of what
the thing is, so we're working from the same picture; the rest is the set of questions I most
want outside eyes on. Take them as "help me see what I can't," not "approve my work." If any
of this is your lived experience or your field, I'd genuinely value your read. There's a
feedback link at the bottom.*

---

## What it is (the short version)

An app that fights STI/HIV stigma in product form: make testing and disclosure ordinary, and
help people make science-based decisions, without the clean/dirty framing. It is harm
reduction, never a filter that sorts people or decides who may have sex.

How it works:

- It's a shareable "passport" that shows **one** thing: whether someone is **up to date on
  testing and actively protecting against HIV**. Three honest ways to qualify: on PrEP,
  undetectable, or a public commitment to always using condoms.
- **U=U is built into the core.** An undetectable person and a person on PrEP show the
  **exact same label** ("on HIV prevention") — you can never tell which is which, and the
  badge never shows anyone's actual status or method.
- **Two states only: blue ("up to date") or gray.** No green (reads as "go"), no yellow/red
  "warning" state — any "be careful with this person" signal would basically out that they
  have something. Gray is a wide bucket (overdue, never tested, taking a break, mid-
  treatment, in care but not yet undetectable) so a single look never decodes to a diagnosis.
- It protects people **during treatment** without exposing why — mid-treatment just shows
  gray, identical to every other reason for gray.
- **No "verified" badges.** Letting people verify with lab results would quietly punish those
  without easy healthcare access and rebuild the hierarchy this exists to dismantle.
  Everyone's badge is the same kind of badge, openly self-reported.
- It points people to **free testing, free condoms, and free/low-cost PrEP** nearby, and it's
  built so the server literally can't read anyone's health data or see who's connected to
  whom.

The honest tension I'm sitting with: rewarding active HIV protection is a mildly "healthist"
choice. I think mid-epidemic it's worth it, and I keep it from becoming a serostatus gate by
making the cheapest route (condoms) count and putting free PrEP/condoms/testing one tap away.
But whether that line sits right is exactly what I want feedback on.

---

## The questions

### 1. The big one: who can show "blue," and who can't

Blue requires being actively protected against HIV (PrEP, undetectable, or public condom
commitment), so two groups can't reach it even if diligent:

- **Someone HIV-positive and in care but not yet undetectable** (newly diagnosed, still
  getting to suppression) shows gray, same bucket as overdue. No single look outs them, but
  over time "tests yet never blue" could be inferred — and because almost everyone on these
  apps will qualify, *not* qualifying might stand out more, not less.
- **Someone who declines PrEP for their own reasons** (side effects, autonomy) and won't
  publicly commit to condoms is gray even if they test constantly. A real PrEP-normative tilt.

**Question:** is rewarding active HIV protection the right call mid-epidemic, or does it throw
the newly-diagnosed and the PrEP-decliners under the bus?

### 2. Grouping condoms with PrEP and U=U

The three routes share the *same* positive state — no ranking. Condoms are real, evidence-
based prevention, but typical-use efficacy is lower than PrEP/U=U. I grouped them anyway,
because a lower tier for condom users re-creates the sorting I'm trying to kill — and I'm
committing the app to honest info pages on the differences instead of encoding a hierarchy
(my small swing at the sex-ed-access gap).

**Question:** does "publicly commits to condoms" genuinely belong in the same tier as
PrEP/U=U, or am I flattening a difference that matters? Does leaning on education-instead-of-
ranking read as honest or as a dodge?

### 3. Language

Banned: clean, dirty, clear, healthy, safe, disease-free, "negative" as an identity. The
badge says **"up to date."** Labels are plain ("on HIV prevention," and a 3-state condom preference).

**Question:** does "up to date" land right, or carry its own baggage? Any words I'm still
using that quietly stigmatize, or read as clinical/policing to someone who's poz?

### 4. Does the whole thing help or harm poz folks — gut check

Intent is anti-stigma: U=U in the core, no clean/dirty framing, harm-reduction not
moralizing. But intent and impact differ.

**Question:** sitting with the whole concept, does it *reduce* stigma, or does a status-
sharing app — however carefully built — inevitably make poz people feel sorted and
surveilled? Is this a tool you'd want to exist?

### 5. Circles, and the "clean club" risk

Groups let people share status within a trusted set and get anonymous "go test" nudges if
someone tests positive. I've kept them mutual-care, not exclusionary (no rankings, no counts,
joining/leaving looks ordinary, private membership by default).

**Question:** does a group construct inevitably drift toward "you have to be blue to belong" —
a serosorting club — no matter how it's framed? Where's the line between "we look out for each
other" and "we keep the wrong people out"?

### 6. What counts as a "known active infection"

Untreated gonorrhea/chlamydia/syphilis would gray someone until treated; detectable HIV until
suppressed. But **chronic lifelong conditions like HSV and HPV must not permanently gray
people** — almost every sexually active adult has been exposed to HPV, and graying someone
forever over herpes would be cruel.

**Question:** does that line feel right? Anything about how the app treats chronic vs. acute
conditions that would feel stigmatizing to people living with HSV/HPV?

### 7. The partner-notification feel

If someone tests positive, their recent contacts get an **anonymous, content-free** nudge —
"a contact suggests getting tested" — never who, when, or what. It's batched and delayed so
timing can't out anyone, and it routes to free testing + PEP. The person controls who's on the
list and can remove anyone easily before it sends — I kept removal *frictionless*, because
making it hard just pushes people toward telling no one.

**Question:** does that feel supportive or accusatory on the *receiving* end? Could a content-
free "go get tested" from an unknown source land as *more* alarming than a direct conversation?

### 8. Anything I'm not seeing

If you live closer to this than I do, **what's the question I haven't thought to ask?**

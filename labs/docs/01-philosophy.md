# sti.care: Philosophy

*The "why" behind the product. Pairs with the Decisions log (what we chose) and the Design doc (how it works). Not legal advice.*

---

## North star

The app exists to make testing and disclosure **easier and more normal**, and to help people make **science-based decisions**. It is a tool for support and harm reduction. It is **never** a filter that sorts people, a gate that decides who may have sex, or a record that can out anyone.

Whenever a design choice could read as either *"come in, here's how we look out for each other, here's free testing nearby"* or *"you don't belong here until you're compliant,"* it takes the former. If it can't, we don't ship the feature.

This is grounded in a reality poz folks routinely face: being treated as a risk to screen out rather than a person. The intervention isn't a safety certificate. It's making the disclosure conversation ordinary and giving people on-ramps to care.

---

## Who we're protecting against

We design as if all of these are adversaries:

- **A viewer** trying to infer someone's diagnosis from what they see.
- **Us / the server.** We hold infrastructure, so we make ourselves *unable* to read the sensitive data rather than promising not to look.
- **A breach or subpoena.** Anything we store can be stolen or compelled; the goal is that what we hold is useless if taken.
- **Other group members.** A group shows only the color each member chose to share by joining it; being in a group is itself that choice, and a group never reveals a member who did not join.
- **An identity provider / carrier.** We minimize what any third party learns.
- **A patient scraper.** Someone polling a public badge over time to build a history.

---

## Core principles

**1. Diagnosis non-decodability against a snapshot.** No single observation of someone's badge may decode to a diagnosis. Achieved by making "gray" a wide, heterogeneous bucket. This is a *snapshot* guarantee, not absolute (see the signal-vs-verdict note).

**2. One positive state, reached three ways, with negative and undetectable identical (U=U).** Blue ("up to date") is a single positive state, no rank above it, reached by any of three evidence-based, status-blind routes: on PrEP, undetectable, or a public commitment to condoms-always. PrEP and undetectable surface only under **one shared umbrella label ("On HIV prevention") that is identical for both and never distinguishes them** (a hard invariant), which lets an undetectable person blend in honestly among the PrEP majority instead of lying. The badge grouping treats protection methods of differing efficacy as "close enough"; we discharge the real difference through **education, not ranking** (see principle 11).

**2a. Healthism, named.** Requiring active HIV protection for the positive state is a deliberate, eyes-open choice to reward prevention *because* we're mid-epidemic. It is mildly healthist, and we accept that, while refusing to let it become a **serostatus gate**: the positive state is reachable by the cheapest, most universal route (condoms), and the app carries first-class access ramps for testing, condoms, and PrEP so the bar is reachable, not a class marker.

**3. Status and access are separate, and access is yours.** *Status* (what you show) is protected: gray never reveals a diagnosis. *Access* (who may see you, which groups you're in) is a **social** choice, not a health fact, and it stays in your hands: you can leave a group or change what you share whenever you want. Two rules hold that line. To everyone else, **"left" and "was removed" look identical**, so an access change never marks anyone. And the system **never** changes your access automatically in response to a health event; that decision is always yours.

**4. Tools, not gates; facts, not verdicts.** The app surfaces honest facts and points to resources; the human draws the conclusion. It never tells a viewer whether/how to have sex, and never tells a user they "shouldn't be having sex." Higher risk → ramps (the four first-class finders: free testing, condoms, PrEP, PEP), never moral rulings. (Doxy-PEP is a flat attribute, not a finder ramp.)

**5. The server is blind: to bodies *and* to the social graph.** All sensitive logic and data (diagnoses, dates, badge math, the contact graph, group membership, handles) live on the user's device in an encrypted blob whose key never reaches us. The server stores only ciphertext and opaque routing tokens. No readable who-has-what, no readable who-knows-whom.

**6. Data minimization.** The best protection against losing data is not having it. No account to *view* a shared status. Per-context aliases, unlinkable across apps. **No real names: display identity is a per-link handle + avatar, set at share time and never shared across links.** A local display name lives in the owner's encrypted blob (for the app to address them) and never reaches the server. **One allowed index:** the public handle registry (`name → aliasId`), an explicit opt-in with clear consent that a short handle is findable at `sti.care/u/{handle}` and reveals the passport exists. Up to 5 handles per account; each is claimed deliberately at link-creation time, never at account creation. No analytics/ad SDKs near health surfaces. Consent at creation, working delete/revoke, minimal retention.

**7. Honesty / no overclaiming.** It's a **self-reported, good-faith signal, not proof, not a medical test.** Said plainly as description, never as a downgrade mark. "Revoke" means "no future reads," never "unsee." We don't market zero-knowledge on public aliases, where the key is in a link anyone can hold.

**8. The safe choice is the default.** Private-by-default everywhere. The lazy path is the protective path. Nobody is exposed because they forgot to flip a setting.

**9. Harm reduction, never moralizing.** Medical-recommended behavior is *one* valid path, not the only acceptable one. The app educates and equips; it does not judge who gets to be a sexual being.

**10. Linkability is the user's choice, taught at the choice point.** We can't make a human unlinkable across apps (reused photos, phrasing, and kinks already correlate people). So we don't promise prevention. We keep the *tool* from being the easiest correlation vector and teach the tradeoff **at the moment it's live** (e.g. when someone picks a memorable handle), not as abstract onboarding noise. Note a vanity handle's stakes are a notch higher than reused photos, because it resolves to a health badge.

**11. Education is the equalizer, not ranking.** The badge deliberately groups protection methods of different efficacy (condoms alongside PrEP/U=U) into one positive state. We don't encode that difference as a hierarchy. We owe users honest, accessible information about it. Clear, non-shaming info pages on what each method does and doesn't protect against are a **core commitment**. When the badge says less than the full truth, the education layer carries the rest.

---

## The signal-vs-verdict tension (read this one twice)

The project's hardest, most recurring fork: is the badge a **conscientiousness signal** (it normalizes testing and opens conversation) or a **risk verdict** (it helps a viewer assess before sex)? Every privacy win we made was the same move, choosing signal over verdict, because anything specific enough to be a verdict leaks, ranks, and gates.

We have landed *near the middle, deliberately*: blue means **"tested ≤90 days, clear, and actively protected against HIV"** by one of three routes (PrEP, undetectable, or public-condom-commitment). That carries real risk-relevant meaning, which is why it "means enough", without ranking anyone, because the three routes share one positive state and the two biomedical routes share one indistinguishable label. The deliberate costs, named not hidden: an **HIV-detectable-but-in-care person can't reach blue** until suppressed (and a near-universal positive state may make non-qualifiers *more* conspicuous), and someone who **declines PrEP** for autonomy reasons must use the condom route or be gray (a PrEP-normative tilt). No single snapshot outs anyone (gray is a wide bucket), but a "tests yet never blue" pattern is inferable over time. Whether these costs are acceptable is a **values call routed to outside review**, not an engineering one (see the Questions doc).

The strongest argument *for* this shape: an undetectable person reaches the same honest top **indistinguishably from PrEP users**, so no one is pushed to hide or misrepresent their status to belong. That is the most pro-U=U thing the product does.

Where additional *meaning* may grow without re-leaking: the **flat-attribute layer** (PrEP, condoms, doxy-PEP), the **surrounding experience** (education, partner notification, the disclosure conversation itself), and the **act of sharing** as a signal of values. Not a richer badge. Every richer badge is the gate in disguise.

---

## The through-line

Fewer distinguishable states, no verdicts, tools-not-gates, and a server kept blind to both **bodies** and the **social graph**. Every mechanism is built so the safe choice is the default and **no diagnosis is ever decodable from a snapshot**, while leaving people free to manage their social connections, and their own linkability, as openly as they choose. When in doubt, we say less, store less, and point people toward care.

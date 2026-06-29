# sti.care: The logged-out viewer's end states

*The "what a person sees when they open a link to someone's passport, and how a broken or incomplete
share is kept from reading as a verdict, an error, or the demo, without ever leaking whether a
passport exists." Pairs with [Reach and access](16-reach-and-access.md) (the three share modes and the
knock flow), [Contact graph & notification](13-contact-graph-and-notification.md) and
[Vanity namespace governance](17-vanity-namespace-governance.md) (why the knock is existence-uniform),
[Progressive web app](22-progressive-web-app.md) (the offline viewer state), [Demo mode](28-demo-mode.md)
(the one surface that is never a share target), and [Voice and tone](21-voice-and-tone.md) (all copy
below, illustrative until drafted for real). Not legal advice.*

---

## In one line

A logged-out viewer can land in one of four places, and the rule that keeps them distinct without
leaking anything is: be specific about what the viewer's own device knows (the link text it was handed,
whether it has signal), and stay uniform about the one thing only the server could answer (whether a
passport exists). A share that arrived broken gets an honest, link-focused message and a way to ask
anyway, never the uniform blank and never the marketing page.

## The principle: separate end states by source of truth

The decryption key rides in the URL fragment (`/a/{id}#k={key}`), so the server never sees it
([store/aliasLink.ts](../../passport/src/store/aliasLink.ts),
[store/contactInvite.ts](../../passport/src/store/contactInvite.ts)). Fragments are exactly the part of
a URL that chat apps, link unfurlers, "open in app" interstitials, and QR re-encoders most often strip.
So "a legitimate share that went nowhere" is, most often, a link whose key was lost in transit: the
viewer holds `/a/{id}` with no usable `#k=`.

That fact is **local**. The viewer's device can tell a keyless or malformed link from a usable one by
looking at the bytes it was handed, with no server call, and being specific about it leaks nothing
about whether the id exists. The split is:

- **Local truths (the link text, the network state):** can be specific and helpful, because saying
  them out loud reveals nothing about any id.
- **The server truth (does this passport exist / are you allowed):** must stay uniform, because that is
  the only place existence could leak.

Today the code collapses a local truth into the server-shaped default, which is the bug below.

## A. What happens today, and the gap

Trace the router ([useAppRouter.ts](../../passport/src/ui/app/useAppRouter.ts), `routeFromLocation`):

- `/a/{id}#k={key}` with a usable key resolves to `a2-public`, which renders the card or, on any
  failure, the **uniform gray-nothing** (`resolved = null`) with a knock affordance. This is correct
  and must not change: a revoked, expired, never-existed, or not-yours link must all look identical
  ([PublicResolutionScreen.tsx](../../passport/src/ui/public/PublicResolutionScreen.tsx)).
- `/a/{id}` **without** a usable key fails `parseAliasLink`, falls through `routeFromHash`, and lands
  on the **generic logged-out landing**. So the most common broken share (key stripped in transit)
  drops the viewer onto the marketing page with no sign that a resolution was even attempted. They
  cannot tell the link broke; they may think the app is broken or that their friend sent them an ad.

There is no "incomplete link" screen for the `/a/` path today (only `/u/{name}` has its own not-found,
doc 17). That missing state is the gap.

**One related path already ships and points the same way.** Receiving a passport link through the OS
share sheet is now resolved on-device by the service worker
([swShare.ts](../../passport/src/sw/swShare.ts)): it validates the shared link with `parseScannedLink`,
reconstructs the `#k=` fragment locally so the key never hits the network, and **fails closed,
redirecting a keyless or foreign share to the app root** rather than leaking or half-rendering. That is
the same fail-closed instinct as gray-nothing, and it confirms the local-truth principle (the key lives
in the fragment, validated on-device). The incomplete-link screen below is the honest upgrade of that
root-redirect: instead of dropping a keyless share on the landing, say plainly that the link did not
come through and offer the ask-anyway path.

## B. The four end states, kept distinct

| State | Trigger | Source of truth | Specific? |
| --- | --- | --- | --- |
| **Incomplete / not a working link** | `/a/{id}` with the key missing or unusable, or not a recognizable link | the received URL text (no server call) | **Yes** (the fix) |
| **Can't reach it** | offline or server unreachable | the viewer's own connection | Yes (doc 22's honest connection state) |
| **Gray-nothing** | usable keyed link, server reached, resolves to decoy or unauthorized | the server | **No**, stays uniform, with the knock action |
| **Demo** | the `/#demo` route only | an explicit route | Yes, always wearing its banner and watermark (doc 28) |

Because the first two come from the device, they can say something useful. The third is the only one
that must stay ambiguous. The fourth can never be reached by a share link, so a failed share and the
demo can never be mistaken for each other.

## C. The incomplete-link state (the fix), and asking anyway

Add a public "incomplete link" screen and route `/a/{id}` to it when no usable key parses, instead of
dropping to the landing. It has two shapes:

- **An id but no key** (the stripped-fragment case): the viewer holds a real-looking passport id, just
  not the key that opens it. Honest, link-focused copy (voice to finalize): **"This link didn't come
  through complete. Ask them to send it again."** And the recovery you can offer safely:
  **"You can still ask to see their status"**, which fires the **existing knock against the id**
  ([PublicResolutionScreen](../../passport/src/ui/public/PublicResolutionScreen.tsx) `onKnock`, which
  uses the id, not the link key, so the owner can grant from their device). A keyless link is not a
  dead end: the viewer can request, and the owner can let them in.
- **No usable id at all** (a truly garbled or non-sti.care URL): **"This isn't a working sti.care link.
  Check you copied the whole thing, or ask them to send it again."** No knock, because there is no id
  of valid shape to ask against.

The copy is about the **link**, never the person, and the screen is visually its own surface, not the
landing and not the demo, so the viewer understands what happened and what to do.

**The "ask anyway" now has a shipped home.** A logged-out viewer who knocks is no longer left waiting
with nowhere to look: the device stores the knocked id locally and a **Requests screen** ("Links you
asked to see") surfaces it, silently re-checking on each open and flipping to "shared with you" once
the owner grants ([pendingKnockStore.ts](../../passport/src/store/pendingKnockStore.ts),
[Requests.tsx](../../passport/src/ui/public/Requests.tsx)). The store is device-local and never sent to
the server, and the list is existence-uniform (it only records that the viewer asked). So the
incomplete-link recovery above lands the viewer into a real, durable "way back," which matters all the
more on a non-persistent native demo or a fresh phone.

> Carried caveat: a contact-invite link also carries its invite capability in the fragment (doc 13), so
> a stripped fragment loses both the key and the two-way contact offer. The knock-by-id recovery still
> lets the viewer see the status once granted; the contact-add half is simply gone, and the viewer is
> told to ask for a fresh link, which restores it.

## D. Gray-nothing stays uniform, and verdict-free

The one server-derived state keeps its invariant and tightens its copy:

- **Uniform:** identical for unauthorized and nonexistent; no distinct loading or error surface
  (already true: `resolved = null` covers loading and every failure).
- **Verdict-free and not an error:** never "not found" (that reads as both an existence answer and an
  app failure) and never anything implying the person has no status. Direction: **"Nothing to show
  here yet. You can ask to see their status."**
- **The honesty guardrail:** we never explain *why* a usable keyed link went nowhere ("revoked",
  "expired"). That is precisely the distinction uniformity exists to hide. We are specific only about
  what the device knows locally; we stay uniform about anything only the server could distinguish.

## E. Why this does not leak

The new branch is safe because it turns on the viewer's own input, not a server fact:

- The router chooses the incomplete-link screen vs `a2-public` **only** by whether the viewer's URL
  carried a usable key. That is the viewer's own text, set by the sender and the transport, never by
  the server.
- The incomplete-link screen makes **no server call**, so it cannot reflect whether the id exists. An
  attacker opening `/a/{guessedId}` with no key always gets the same incomplete-link screen, real id or
  not.
- The only server touch it offers is the **knock**, which is existence-uniform by construction (the
  server does identical work for a real, fake, or guessed knock, doc 13 and doc 17).
- A usable keyed link still resolves through the unchanged uniform gray-nothing.

So a viewer (or an attacker) learns nothing about existence they did not already supply, while a real
viewer with a broken link finally gets told the link broke and offered a way through.

## F. Build slices

1. **The incomplete-link screen and route.** A new public screen id (for example `a2-incomplete`), and
   a `routeFromLocation` branch that sends an `/a/{id}`-shaped path with no usable key there (carrying
   the id when one is present), instead of falling through to the landing.
2. **The knock-anyway recovery.** Wire the existing knock-by-id and its approval poll into the
   id-present shape, reusing `PublicResolutionScreen`'s path so there is no second knock implementation.
3. **Gray-nothing copy pass.** Make the uniform state verdict-free and not-an-error, per section D.
4. **Tests:** a router test that a keyless `/a/{id}` reaches the incomplete-link screen, not the landing
   and not a resolving `a2-public`; an invariant test that the incomplete-link screen issues no resolve
   call and renders identically for a real and a fake id; and that the knock path is the existing
   uniform one. Plus the standard gates (typecheck, lint, test, build, build-storybook, prettier, Go
   suite, no em dashes).

## G. Open questions

- **Key present but unusable.** A fragment that is present but not a valid key: route to the
  incomplete-link screen (local, no server call) or let it reach the uniform gray-nothing (a server
  round trip)? Recommendation: if it is locally determinable as not a usable key, treat it as
  incomplete (more helpful, and one fewer server touch); pin the exact boundary against
  `parseAliasLink`'s validation.
- **Naming the link.** Whether the incomplete-link copy should say "sti.care passport link" explicitly
  (clearer for the viewer) or stay generic. Either is privacy-safe; this is a voice call.
- **Truncated ids.** Only offer the knock-anyway recovery when an id of valid shape is present; a
  visibly truncated id should fall to the no-id copy rather than knock into nothing. Confirm the shape
  check.
- **A "from a link" hint on the landing.** As an alternative or complement, the landing could detect it
  was reached from an `/a/` path and soften accordingly. The dedicated screen is cleaner; noted in case
  the screen is deferred.

# sti.care: The logged-out viewer's end states

*The "what a person sees when they open a link to someone's passport, and how a share that arrives
without a key is kept from reading as a verdict, an error, or the demo, without ever leaking whether a
passport exists." Pairs with [Reach and access](16-reach-and-access.md) (the three share modes, the
gated keyless share, and the knock flow), [Contact graph & notification](13-contact-graph-and-notification.md)
and [Vanity namespace governance](17-vanity-namespace-governance.md) (why the knock is
existence-uniform), [Progressive web app](22-progressive-web-app.md) (the offline viewer state),
[Demo mode](28-demo-mode.md) (the one surface that is never a share target), and
[Voice and tone](21-voice-and-tone.md) (all copy below). Not legal advice.*

---

## In one line

A logged-out viewer who opens a link lands in one of a few places, and the rule that keeps them
distinct without leaking anything is: be specific about what the viewer's own device knows (whether the
URL is a recognizable link, whether it has signal), and stay uniform about the one thing only the server
could answer (whether a passport exists, and whether you may see it). Everything that holds a real link
id but cannot be rendered, for any reason, lands on the same uniform "nothing to show, ask to see it"
state, so a revoked, expired, never-existed, unauthorized, or simply keyless link are all
indistinguishable.

## The principle: separate end states by source of truth

The decryption key rides in the URL fragment (`/a/{id}#k={key}`), so the server never sees it
([store/aliasLink.ts](../../passport/src/store/aliasLink.ts),
[store/contactInvite.ts](../../passport/src/store/contactInvite.ts)). Fragments are exactly the part of
a URL that chat apps, link unfurlers, "open in app" interstitials, and QR re-encoders most often strip,
and a keyless `/a/{id}` is also a legitimate share in its own right (the gated "ask first" mode, doc
16). Either way the viewer holds an id with no usable `#k=`.

The split that decides what we may say:

- **Local truths (the URL shape, the network state):** can be specific, because saying them out loud
  reveals nothing about any id. The device can tell a recognizable `/a/{id}` from a garbled URL by
  looking at the bytes it was handed, with no server call.
- **The server truth (does this passport exist, may you see it):** must stay uniform, because that is
  the only place existence could leak.

The shipped design draws the line conservatively: it is specific only about the one local fork that is
always safe (is this a recognizable link at all), and folds everything else, keyless and keyed alike,
into the single uniform server-shaped state.

## A. The end states, as they ship

Trace the router ([useAppRouter.ts](../../passport/src/ui/app/useAppRouter.ts), `routeFromLocation` →
`aliasRoute`):

- **Resolved card.** `/a/{id}#k={key}` with a usable key resolves through the store and renders the
  owner's card ([PublicResolutionScreen.tsx](../../passport/src/ui/public/PublicResolutionScreen.tsx)).
- **Gray-nothing, with the knock.** Anything that carries a valid-shaped id but cannot render falls to
  the uniform gray state with the "ask to see their status" affordance. That one bucket holds every
  case that must stay indistinguishable: a keyed link that resolves to a decoy or an unauthorized
  viewer, a revoked or expired link, a never-existed id, and a **keyless `/a/{id}`** (the gated share,
  or a keyed link whose fragment was stripped in transit, which are the same bytes). A keyless id
  routes to `a2-public` with no key, so `resolveAlias` yields the uniform null and the screen shows the
  knock. The viewer holds a link, so the knock affordance is offered (`linkHolder`); a later in-app
  grant flips the same screen to the card with no new navigation.
- **Can't reach it.** Offline or an unreachable server is the viewer's own connection, so doc 22 owns
  an honest "looks like you're offline" state for the viewer-facing surface rather than a server-shaped
  blank.
- **Landing.** Only a URL that is **not** a recognizable `/a/{id}` link at all (a garbled or truncated
  id that fails the shape check, or some other path) falls through to the public landing. A real
  link-shaped id never lands here.
- **Demo.** The `@demo` passport is reached only by an explicit in-app action (doc 28), never by a
  share link, and always wears its banner, so a share that went nowhere and the demo can never be
  mistaken for each other.

**One related path resolves the key entirely on-device.** Receiving a passport link through the OS
share sheet is handled by the service worker ([sw/swShare.ts](../../passport/src/sw/swShare.ts)): it
validates the shared link with `parseScannedLink`, reconstructs the `#k=` fragment locally so the key
never hits the network, and **fails closed**, redirecting a keyless or foreign share to the app root
rather than leaking or half-rendering. That is the same fail-closed instinct as gray-nothing, applied
at the share-target boundary.

## B. Why a keyless link is not its own "broken link" screen

It is tempting to give a keyless `/a/{id}` an honest, link-focused message ("this link didn't come
through complete, ask them to resend"). The shipped design deliberately does **not**, because it
cannot, safely or honestly:

- A keyless link is a **legitimate share mode**, not a malfunction. The gated "ask first" share (doc
  16) is keyless by design: the owner shares `/a/{id}` so the viewer must request access rather than
  read the card directly. Telling that viewer their link "didn't come through" would be wrong.
- A keyed link whose fragment was stripped in transit arrives as the **exact same bytes**: `/a/{id}`
  with no `#k=`. The device cannot tell the two apart, so any message that assumes one is wrong for the
  other.
- The uniform "nothing to show, you can ask to see their status" answers both correctly. It does not
  claim anything is broken, and it offers the one recovery that works either way: the **knock against
  the id**, which the owner can grant from their own device ([PublicResolutionScreen](../../passport/src/ui/public/PublicResolutionScreen.tsx)
  knocks by id, not by the link key). A keyless link is never a dead end.

So the keyless case folds into gray-nothing on purpose. The only thing the router is specific about is
the always-safe local fork (recognizable link vs not), which is why a garbled URL still falls to the
landing rather than pretending to be a passport.

## C. The "ask anyway" recovery has a durable home

A logged-out viewer who knocks is not left waiting with nowhere to look. The device stores the knocked
id locally and a **Requests screen** ("Links you asked to see") surfaces it, silently re-checking on
each open and flipping to the shared card once the owner grants
([store/pendingKnockStore.ts](../../passport/src/store/pendingKnockStore.ts),
[ui/public/Requests.tsx](../../passport/src/ui/public/Requests.tsx)). The store is device-local and
never sent to the server, and the list only records that the viewer asked, so it is existence-uniform.
That gives the gray-nothing-plus-knock state a real, durable way back, which matters most on a fresh
phone or after a reload.

> Carried caveat: a contact-invite link also carries its invite capability in the fragment (doc 13), so
> a stripped fragment loses both the key and the two-way contact offer. The knock-by-id recovery still
> lets the viewer see the status once granted; the contact-add half is simply gone, and a fresh link
> restores it.

## D. Gray-nothing stays uniform, and verdict-free

The one server-derived state keeps its invariant and its honest, non-clinical copy:

- **Uniform:** identical for unauthorized, nonexistent, keyless, revoked, and expired; no distinct
  loading or error surface (`resolved = null` covers loading and every failure in
  [PublicResolutionScreen](../../passport/src/ui/public/PublicResolutionScreen.tsx)).
- **Verdict-free and not an error:** the gray card explains itself as normal, not a warning ("Gray just
  means there's no status to show right now. That's normal, not a warning, and not an STI."), and the
  knock is framed as a request, not a failure ("Have a link to them? ... Request access"), per
  [PublicResolution.copy.ts](../../passport/src/ui/public/PublicResolution.copy.ts). It never says "not
  found", which would read as both an existence answer and an app failure.
- **The honesty guardrail:** we never explain *why* a keyed link went nowhere ("revoked", "expired").
  That is precisely the distinction uniformity exists to hide. We are specific only about what the
  device knows locally, and uniform about anything only the server could distinguish.

## E. Why this does not leak

The one place the router forks on viewer input is safe, and everything else is server-uniform:

- The router chooses the landing vs `a2-public` **only** by whether the URL is a recognizable `/a/{id}`
  link, which is the viewer's own text, set by the sender and the transport, never by the server. A
  keyless but well-shaped id always reaches the same gray-nothing-plus-knock, real id or not.
- The gray-nothing state is reached identically by a real, fake, guessed, unauthorized, revoked, or
  keyless id. An attacker opening `/a/{guessedId}` learns nothing they did not supply.
- The only server touch it offers is the **knock**, which is existence-uniform by construction (the
  server does identical work, and returns the same "if this person registered, your request was sent",
  for a real, fake, or guessed knock, doc 13 and doc 17).

So a viewer (or an attacker) learns nothing about existence they did not already supply, while a real
viewer who is missing a key is never stranded: they can ask, and the owner can let them in.

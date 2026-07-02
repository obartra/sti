# 23 - Privacy policy, terms, and the trust footer

Status: BUILT (the trust footer, the `/privacy-policy` and `/terms` pages, and the landing link all shipped).

## Why now

The `/promises` page (docs 11, the privacy principles) is the product's trust
pitch, but today it is only reachable from the Privacy screen, which sits behind
onboarding. The one place a privacy-skeptical person decides whether to trust a
sexual-health app, the opening `a1-landing` screen, has no link to it.

At the same time we have no privacy policy and no terms of service. For an app
that handles sexual-health data, both are expected and prudent, and ours are
unusually short and strong precisely because of the blind-store design: there is
very little we can say we hold, because there is very little we can read.

This doc covers three things that ship together:

1. A sitewide **trust footer** that links the promises page, the privacy policy,
   and the terms from every screen, logged in or out.
2. A **privacy policy** page, plain-English, grounded in what the code actually
   does.
3. A **terms of service** page, covering what the promises cannot: the
   self-reported nature of a status, no warranty, acceptable use, and age.

## Scope and non-goals

In scope: the footer component, two new static content pages and their routes,
a landing-page link into the trust surface, and the copy for all of it.

Non-goals:

- This is not legal advice and the drafts here are not authoritative legal text.
  They are written to be **accurate to the system**, and must get a lawyer's
  review before a real launch. Where a clause needs counsel (governing law,
  jurisdiction, a company entity, a contact of record), the page ships a clearly
  marked placeholder, never an invented fact.
- No new data collection, no analytics, no cookies. The policy describes the
  current system; it does not authorize expanding it.
- No change to any blind-store invariant. These are read-only content pages.

## Information architecture

### Routes

Three sibling content screens under a shared "what we stand behind" grouping,
all in the `public` group so they are reachable logged out and directly by URL:

- `promises` (exists today)
- `privacy` is already taken by the in-app Privacy **settings** screen, so the
  policy gets a distinct screen id: `privacy-policy`.
- `terms`.

`privacy-policy` and `terms` are pure functions of static copy (like the
promises page), so they are storyable and need no state.

### The trust footer (public surfaces only)

A persistent website-style footer on every logged-in screen makes the app feel
like a webpage, not an app. So the `TrustFooter` renders only on the **public**
surfaces: the mobile and desktop landing, the `public`-group content pages
(promises, privacy-policy, terms themselves), and the published marketing site
(which is the landing). It does NOT render inside the logged-in app shell.

The footer carries:

- **Our promises** -> `promises`
- **Privacy** -> `privacy-policy`
- **Terms** -> `terms`
- **STI basics** -> the education library at info.sti.care (external, in a new
  tab; the library itself is [doc 34](34-education-library-subdomain.md))

Plus a one-line, voice-compliant tagline (no meta, no jargon), for example
"Encrypted on your phone. We can't read it." The footer is quiet: small type,
muted color, never competing with a screen's primary action.

It also carries a quiet "Something wrong?" link that opens a short in-app form
([doc 35](35-something-wrong-reports.md)). It replaced a `mailto:` link so a
report lands in the operator queue instead of an inbox; `privacy@sti.care` stays
on this page and the terms page as the way to reach a human for a reply.

The landing screen additionally gets a primary-adjacent link into the promises
page (a short "See what we promise" link near the main call to action), since
that is where the trust decision is made and a footer alone is too quiet there.

### The same links inside the logged-in app (app-native)

Logged in, the three links live the conventional Settings way: the existing
Privacy settings screen (which already links promises) gains a small "About and
legal" group with **Our promises**, **Privacy**, and **Terms**. Onboarding's
consent copy links `privacy-policy` and `terms` inline at the point a user
creates an account. No footer is worn by the app.

## The privacy policy (plain-English content)

Lead with the user's outcome, then the honest detail. Draft copy:

### What we can see

Almost nothing. Everything you record, your status, your tags, your contacts, is
encrypted on your phone with a key that never leaves your device. Our server
only ever holds the encrypted version and some opaque routing labels. We can't
read your status, your contacts, or who you've shared with. Even an admin
sign-in unlocks none of it; the admin tools only ever touch encrypted records.

### What the server actually holds

| What | What it is | Can we read it? |
| --- | --- | --- |
| Your status card | Encrypted bytes (`alias`) | No |
| Your account backup | Encrypted bytes (`account`) | No |
| A shared inbox per contact | Encrypted bytes (`notify_inbox`) | No |
| Routing labels and queued updates | Opaque tokens + encrypted bytes (`notify_route`, `republish_queue`, `send_queue`, `cover_send`) | No |
| A public name, if you claim one | A name you chose, on purpose public (`vanity_name`) | Yes, that is the point |
| Access requests | Opaque, short-lived (`knock`) | No |
| Notification subscription, if you turn notifications on | A push-service address + keys (`push_endpoint`) | The address is a third-party push service's, not your identity |
| Admin action log | What an operator did and to which opaque record, and when (`admin_audit`) | It records actions, never content |
| Reports against public names | A fixed reason code + the public name (`vanity_report`) | No free text |
| A "something wrong" note, if you send one | The category you picked and any message you typed (`feedback`) | Yes, so we can read and act on it |

We do not ask you for your email, your real name, or your location, and we do not
store what you write. The one exception is a problem report you send us on
purpose, so we can read it and help (we can't fix what we can't see); the form
asks you to leave out anything sensitive, and no identity is stored with it. We
hold no list of who your contacts are ([doc 35](35-something-wrong-reports.md)).

### What we never collect

No analytics. No trackers. No advertising. No cookies for tracking. No
third-party scripts. The app talks to exactly one server, ours.

### Your network address

Like any website, our edge and server briefly see your IP address when your app
makes a request. We use it only to rate-limit abuse, in memory and short-lived,
and we do not write it to our database or keep request access logs of it. We do
not use it to build a profile.

### Who else is involved

- Our hosting and network providers (the company that runs the server, and the
  edge/CDN in front of it) handle encrypted traffic on our behalf.
- If you turn on notifications, your phone's push service (Apple, Google, or
  Mozilla, depending on your device and browser) delivers a contentless "open
  the app" wake. That wake carries no who and no what.

We do not sell or share your data, because we do not have readable data to sell.

### How long we keep things

- A private link's encrypted card stays until you turn it off (which overwrites
  it), or until an expiry you set passes. A public profile does not expire on a
  timer: it stays until you take it down or release its public name.
- Connections stay on your device until you remove them. We do not auto-remove
  them.
- Access requests are short-lived and auto-expire.
- Your account backup stays until you delete it.
- A "something wrong" note is kept until we have read it, then swept on a fixed
  schedule; we do not keep it indefinitely.
- The admin action log is append-only and retained for accountability; it holds
  no content.

### Your choices

You hold the keys. You can turn any link off (no future reads), and you can
delete your account from the app, which overwrites your shared links and removes
your encrypted backup. Honest limit: because only your device holds your keys,
if you lose them and your recovery phrase, we cannot recover your data for you,
and we cannot un-show something a person already saw.

### Age

sti.care is for adults, 18 and over.

### Changes

If this policy changes we will update this page and its date.

### Contact

Questions about privacy: privacy@sti.care.

## The terms of service (plain-English content)

### What sti.care is, and is not

sti.care is a private place to record and share a self-reported sexual-health
status. It is **not** a medical test, a diagnosis, or a substitute for getting
tested or talking to a clinician. A status is one person's own honest word, not
a lab result, and we do not verify it. Use a status to start a conversation, not
to skip testing, protection, or care.

### No warranty

The service is provided as is and as available. We work hard to keep it private
and available, but we can't promise it is error-free, secure against every
possible threat, or always reachable, and you use it at your own discretion. To
the fullest extent the law allows, we are not liable for any loss arising from
your use of, or inability to use, the service. Nothing here limits liability that
the law does not allow us to limit.

### Using it fairly

Don't use sti.care to harm people. In particular:

- Don't claim a public name to impersonate someone, harass, or post a hateful
  handle. Public names pass a block list and can be taken down (doc 17).
- Don't use the service to coerce, pressure, or out anyone.
- Don't attack, probe, or try to break the service or its protections.

### Your account

Your keys live on your device. You can delete everything from the app. We may
take down a public name that breaks the rules above, following the
report-and-takedown process in doc 17.

### Eligibility

You must be 18 or older to use sti.care.

### Changes and contact

We will post any changes to these terms on this page. Questions:
privacy@sti.care.

## Voice and honesty constraints

All copy follows doc 21: plain language, no jargon (no "decoy", "alias",
"knock", "findable", "resolve" in user copy), no meta or preamble, no overclaim.
Every protective claim on these pages must be true of the shipped code; if a
sentence would say more than the code delivers, it gets cut or qualified. The
privacy policy's strength is that it can be read aloud and is simply true.

## Build plan (after approval)

1. `TrustFooter` component + story, rendered by the shell/chrome for all groups
   and by the mobile and desktop landing layouts.
2. `privacy-policy` and `terms` screens (static copy modules + components +
   stories), added to `routes.ts` (`public` group) and the screen registry.
3. A short promises link near the landing call to action.
4. Link `privacy-policy` and `terms` from the onboarding consent copy.
5. Tests: every footer link resolves to a real route (a routing test, the same
   spirit as the publicScreens test); the new pages render their copy; a voice
   check that the pages carry none of the banned vocabulary. The promises CI
   gate is unaffected.
6. Visual: the footer renders on every screen, so this shifts many baselines.
   Regenerate via the `screenshot:update` label per the visual hand-off rule;
   do not hand-edit baselines.

## Resolved decisions

1. **Age:** 18 and over, in both documents.
2. **Two pages**, not one combined Legal page: `privacy-policy` and `terms`, for
   clarity and linkability.
3. **Placeholders, minimized and resolved before build.** Liability is written in
   plain English (still worth a counsel pass before a real launch, but not a
   blank). The policy and terms refer to "sti.care" and name no formal legal
   entity, because there isn't one yet. Contact is privacy@sti.care. Governing
   law / jurisdiction is intentionally omitted for the MVP and revisited at
   incorporation rather than inventing one. Net: no placeholder ships in the
   user-facing copy.
4. **Marketing surface:** the published site's root IS the landing, so the
   `TrustFooter` on the landing already serves the marketing surface. The
   standalone static promises report (`build-promises.mjs`) gets the same small
   link row for consistency.

## Residual for a real launch (not blockers for this build)

A lawyer should review the liability and terms wording, and governing law and a
responsible entity get filled in at incorporation. These are flagged here, not
hidden in the page copy.

## Operational note: privacy@sti.care

The contact address is set up by the operator via Cloudflare Email Routing on the
`sti.care` zone (the same mechanism as `alerts@`); it is not provisioned by this
change. Steps are handed to the operator separately.

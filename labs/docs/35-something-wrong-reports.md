# sti.care: "Something wrong?" reports

_The public "Something wrong?" link becomes a small in-app form instead of a
`mailto:`. A report lands in an operator queue in `/admin`, and the box emails the
operator a bare nudge so a waiting report is not missed. This is the first place a
user's own typed words are stored on the server, so it is disclosed plainly in the
privacy policy ([doc 23](23-privacy-terms-and-trust-links.md))._

## Why this doc

Today the only way to flag a problem is the "Something wrong? Email us" link in the
public trust footer, a `mailto:privacy@sti.care`. It was a deliberate "collect
nothing" choice, but a report then lands unstructured in an inbox: no queue, no
record, easy to lose, and nothing the `/admin` reviewer already built for reported
public names ([doc 20](20-admin-surface.md)) can help with.

This replaces that link with an in-app form that files a report the operator reviews
in `/admin`, plus an email nudge so action is not missed. `privacy@sti.care` stays on
the privacy and terms pages as the way to reach a human for a reply; this form is
one-way and does not promise one.

## What a report is

A report is a fixed **category** plus an **optional note** the person types:

- Category (a fixed, validated set, never free-form on the wire): something is
  broken, something is confusing, a safety concern, or something else.
- An optional short note, length-capped, so a person can say what happened.

The note is the tradeoff. A useful problem report needs room to describe the problem,
so unlike the public-name report (a reason code and nothing else,
[doc 17](17-vanity-namespace-governance.md)), this stores text a person wrote. That
is the **only** user-typed text the server holds, and it is disclosed as such (see
Privacy). It is stored because the person chose to send it so we can read it and
help, not collected in the background; the form asks them to leave out anything
sensitive, like their name.

## The blind-store boundary

A report is operator-readable by design: the whole point is that a human reads it. So
like a public name and a public-name report, it is stored **in the clear**, not under
a user key. It carries no identity: no account link, no address, no network address,
only the category, the optional note, and a timestamp. Storing it changes nothing
about encrypted user content, which the operator still cannot read
([doc 20](20-admin-surface.md), the blind-store boundary).

## The flow

1. **Intake (public, unauthenticated, rate-limited).** The form posts to a public
   endpoint, rate-limited per-IP and globally like the public-name report intake. The
   category is validated against the fixed set and the note is length-capped;
   anything else is a `400`. A valid report is stored and the endpoint returns a
   uniform `202`. It echoes nothing.
2. **Queue.** The report joins an operator queue, newest first, capped. Read through
   a bearer + flag gated admin endpoint, within the blind-store boundary.
3. **Review.** The operator reads the queue in `/admin` and marks a report resolved
   with one click. Resolve is audited (a fixed verb, the opaque row id, and a time),
   like every other admin mutation.
4. **Retention.** A resolved report and any old report is swept by the existing
   background janitor after a fixed window, so nothing lingers. The privacy policy
   states this.

## The email nudge (no server mail, no content)

The server stays blind and holds no mail credentials, so it does not send email. The
box already scrapes the loopback metrics endpoint every minute and can send the
operator mail over a DMARC-aligned path ([doc 12](12-observability-and-metrics.md),
the alert timer). Intake increments a metrics counter; when the counter rises between
two scrapes, the box emails a **bare nudge** and nothing more:

```
Subject: [sti.care] N new report(s) waiting
Body:    N new report(s) came in. Open https://sti.care/admin to review.
```

No category, no note, no content leaves the box. The nudge is a separate message from
the operational alerts so "page / warn" severity stays clean, and it fails safe the
same way (a missing recipient or sender logs to the journal, never a silent loss).

**Activation.** The nudge logic lives in the `alert.sh` timer script, which the
binary-only CI deploy does not touch on purpose (a leaked deploy key must not be able
to ship a root script, see `stiapi-deploy.sh`). So the intake, the counter, and the
queue go live with the normal backend deploy, but the nudge itself starts firing only
after the operator refreshes the box's `stiapi-alert` via a `provision.sh` run. Until
then reports still land in `/admin`; the operator just is not emailed about them.

## Privacy

The privacy policy ([doc 23](23-privacy-terms-and-trust-links.md)) owns what the
server holds. The framing there is the honest one: we do not store what you write,
with a single exception, a problem report you send us on purpose, so we can read it
and help (we can't fix what we can't see). That report is the category picked plus any
note typed, kept until it is reviewed and then swept, and no identity is stored with
it. The form asks the person to leave out anything sensitive, like their name.

## Surfaces

- **User:** the footer's "Something wrong?" link opens the form (a public content
  screen, reachable logged out, alongside the promises / privacy / terms pages in
  [doc 23](23-privacy-terms-and-trust-links.md)). The footer copy drops "Email us".
- **Operator:** a new review panel in `/admin` beside the reported-names panel, with
  the endpoints and audit verbs added to [doc 20](20-admin-surface.md).

## What this does not change

- No new ability to read encrypted user content, no identity on a report, no reply
  channel (that stays `privacy@sti.care` on the legal pages).
- The blind server gains no SMTP client and no mail credentials; the nudge rides the
  box's existing mail path.

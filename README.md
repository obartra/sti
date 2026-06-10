# sti.care

[![Netlify Status](https://api.netlify.com/api/v1/badges/56bdd737-fada-420f-8277-eb8edd5aa50a/deploy-status)](https://app.netlify.com/projects/sticare/deploys)
[![labs.sti.care](https://img.shields.io/website?url=https%3A%2F%2Flabs.sti.care%2F&up_message=live&down_message=down&label=labs.sti.care)](https://labs.sti.care/)

A tiny site that helps people find a place to get tested and read simple,
judgment-free info on common STIs. Available in English, Spanish, Portuguese
(Brazilian), and French.

## Structure

The site is plain HTML/CSS/JS — **no build step, no framework**. Source lives in
`public/`, which Netlify publishes as-is. Tooling lives at the repo root.

```
public/
  index.html        markup + <head> (SEO / social / favicon)
  styles.css        all styles
  favicon.svg
  src/
    data.js         content (all 4 languages) + decoration shape library/config
    render.js       pure view functions (data in → HTML string out)
    app.js          controller: state, routing, language toggle, DOM wiring
netlify.toml        deploy + routing + security/HTTPS/cache headers
test/               Node tests for the pure view layer
```

The split is deliberate: `data.js` and `render.js` have no DOM access, so they
import and test cleanly in Node; `app.js` is the only file that touches the
browser.

## URLs

Routing uses real, shareable paths via the History API (no `#/` hash). The path
encodes only the topic — **language is not in the URL**:

| URL          | Shows          |
| ------------ | -------------- |
| `/`          | Home           |
| `/gonorrhea` | Gonorrhea info |
| `/hiv`       | HIV info       |
| `/herpes`    | Herpes info    |

Topics: `gonorrhea`, `chlamydia`, `syphilis`, `hiv`, `herpes`, `hpv`.

So `sti.care/gonorrhea` is one clean link that everyone can share — each visitor
sees it in their own language.

### Language selection

Language is chosen per visitor, in this order:

1. `?lang=xx` query param, if present (e.g. `sti.care/hiv?lang=es`). Remembered
   after the first visit.
2. A previously remembered choice (saved in `localStorage`).
3. The browser's language.
4. English, as a fallback.

Switching language with the toggle updates the page in place and remembers the
choice; it never changes the URL.

## Development

Requires Node 22+. There's nothing to build — the scripts are just checks.

```sh
npm install
npm run dev          # serve public/ locally
npm run format       # apply Prettier
npm run lint         # ESLint (JS) + Stylelint (CSS)
npm test             # Node tests for the view layer
npm run check        # format:check + lint + test (what CI runs)
```

CI (GitHub Actions, `.github/workflows/ci.yml`) runs `npm run check` on every
pull request.

## Deploying to Netlify

Connected for autodeploy: every push to `main` deploys to production, and every
PR gets a Deploy Preview. Settings come from `netlify.toml`, so the dashboard
fields can be left blank:

- **Build command:** _(none)_
- **Publish directory:** `public`

### Custom domain + always-on HTTPS

1. Netlify → **Domain management → Add `sti.care`**, then point DNS (switching
   the registrar's nameservers to Netlify's is easiest; otherwise `A` apex →
   `75.2.60.5` and `CNAME` `www` → the `*.netlify.app` site).
2. Netlify auto-provisions a free Let's Encrypt certificate.
3. Enable **Force HTTPS** in Netlify (redirects http → https). On top of that,
   `netlify.toml` sends an HSTS header (`Strict-Transport-Security`) so browsers
   refuse to connect over plain http after the first visit.

### Why the redirect in `netlify.toml` matters

```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

Clean routes like `/gonorrhea` aren't real files, so this serves `index.html`
for any unknown path and lets the in-page router render the topic. Real files
(CSS, JS, the favicon) are still served normally.

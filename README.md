# sti.care

A tiny, single-file site that helps people find a place to get tested and read
simple, judgment-free info on common STIs. Available in English, Spanish,
Portuguese (Brazilian), and French.

## Structure

- `index.html` — the entire site (markup, styles, content, and router).
- `netlify.toml` — Netlify deploy + routing config.

There is **no build step**: the site runs straight from `index.html`.

## URLs

Routing uses real, shareable paths via the History API (no `#/` hash). The path
encodes only the topic — **language is not in the URL**:

| URL              | Shows                                   |
| ---------------- | --------------------------------------- |
| `/`              | Home                                    |
| `/gonorrhea`     | Gonorrhea info                          |
| `/hiv`           | HIV info                                |
| `/herpes`        | Herpes info                             |

Topics: `gonorrhea`, `chlamydia`, `syphilis`, `hiv`, `herpes`, `hpv`.

So `sti.care/gonorrhea` is one clean link that everyone can share — each visitor
sees it in their own language.

### Language selection

Language is chosen per visitor, in this order:

1. `?lang=xx` query param, if present (handy for sharing a specific language,
   e.g. `sti.care/hiv?lang=es`). It's remembered after the first visit.
2. A previously remembered choice (saved in `localStorage`).
3. The browser's language.
4. English, as a fallback.

Switching language with the toggle updates the page in place and remembers the
choice; it never changes the URL.

## Deploying to Netlify (with autodeploy)

The repo is ready to deploy as-is — no build configuration needed.

1. In Netlify: **Add new site → Import an existing project** and pick this
   GitHub repo.
2. Settings are read from `netlify.toml`, so leave the UI fields blank:
   - **Branch to deploy:** `main` (production; PRs get Deploy Previews)
   - **Base directory:** _(empty)_
   - **Build command:** _(empty — no build)_
   - **Publish directory:** `.` (repo root)
3. **Deploy.** From then on, every push to `main` auto-deploys, and every PR
   gets its own preview URL.

### Custom domain: sti.care

1. In Netlify: **Domain management → Add a domain → `sti.care`**.
2. Point DNS at Netlify, either:
   - **Netlify DNS (easiest):** at your registrar, change the nameservers to the
     four Netlify nameservers shown in the dashboard. Netlify then manages the
     apex (`sti.care`), `www`, and HTTPS automatically.
   - **Keep your DNS:** add an `A` record for the apex `sti.care` →
     `75.2.60.5` (Netlify's load balancer; or use an `ALIAS`/`ANAME` to
     `apex-loadbalancer.netlify.com`), and a `CNAME` for `www` →
     `<your-site>.netlify.app`.
3. Set the primary domain and let Netlify redirect the other host to it
   (e.g. `www.sti.care` → `sti.care`).
4. Netlify auto-provisions a free Let's Encrypt certificate once DNS resolves —
   `https://sti.care` works within minutes to a few hours.

### Why the redirect in `netlify.toml` matters

```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

Clean routes like `/gonorrhea` aren't real files, so this serves `index.html`
for any unknown path and lets the in-page router render the topic. Real files
(assets, etc.) are still served normally.

## Local preview

It's just a static file:

```sh
npx netlify-cli dev          # mimics Netlify's SPA fallback
# or
python3 -m http.server 8000  # quick look (deep links won't fall back)
```

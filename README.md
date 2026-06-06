# STI Testing

A tiny, single-file site that helps people find a place to get tested and read
simple, judgment-free info on common STIs. Available in English, Spanish,
Portuguese, and French.

## Structure

- `index.html` — the entire site (markup, styles, content, and router).
- `netlify.toml` — Netlify build/deploy + routing config.

There is **no build step**: the site is plain HTML/CSS/JS that runs straight
from `index.html`.

## URLs

Routing uses real paths via the History API (no `#/` hash):

| URL              | Shows                          |
| ---------------- | ------------------------------ |
| `/`              | Home, in the browser language  |
| `/en`            | Home in English                |
| `/es`            | Home in Spanish                |
| `/en/gonorrhea`  | Gonorrhea info, in English     |
| `/fr/hiv`        | HIV info, in French            |

Languages: `en`, `es`, `pt`, `fr`. Conditions: `gonorrhea`, `chlamydia`,
`syphilis`, `hiv`, `herpes`, `hpv`. Visiting `/` normalizes the address bar to
the detected language (e.g. `/en`).

## Deploying to Netlify (with autodeploy)

The repo is ready to deploy as-is. Connect it once and every push to the
production branch auto-deploys.

1. In Netlify: **Add new site → Import an existing project** and pick this
   GitHub repo.
2. Build settings are read from `netlify.toml`, so you can leave the UI fields
   blank:
   - **Branch to deploy:** `main` (production). Pull requests get automatic
     Deploy Previews.
   - **Base directory:** _(empty)_
   - **Build command:** _(empty — no build)_
   - **Publish directory:** `.` (repo root)
3. Click **Deploy**.

After that, pushing to `main` triggers a production deploy automatically, and
every PR gets its own preview URL.

### Why the redirect matters

`netlify.toml` includes a single-page-app fallback:

```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

The clean routes (`/en/gonorrhea`, etc.) aren't real files, so this serves
`index.html` for any unknown path and lets the in-page router handle it. Real
files (like assets) are still served normally.

## Local preview

It's just a static file, so anything that serves the folder works. To mimic
Netlify's SPA fallback locally:

```sh
npx netlify-cli dev
# or, for a quick look without routing fallback:
python3 -m http.server 8000
```

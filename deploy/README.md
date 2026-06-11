# Prototype deploys to GitHub Pages

`sti.care` (the apex) stays on Netlify. This folder is a **separate** pipeline
that publishes a prototype zip to [`labs.sti.care`](https://labs.sti.care/) via
GitHub Pages, on the `gh-pages` branch.

- **Custom domain:** `labs.sti.care` (set in [`CNAME`](CNAME))
- **Branch:** `gh-pages` (orphan; every deploy replaces it and its history)
- **Source of truth:** whatever zip you drop in the repo root. Nothing here is
  built from the repo; `main` and Netlify are untouched.

Zips in the repo root are gitignored (`/*.zip`), so they never get committed.

## Quick start

Drop a zip in the repo root and run:

```sh
deploy/deploy.sh                 # uses the newest *.zip in the repo root
deploy/deploy.sh path/to/x.zip   # or name one explicitly
deploy/deploy.sh --dry-run       # build the tree and print it, don't push
```

That picks the zip, prepares it, and publishes it to `gh-pages` in one shot.

## The three scripts

The work is split so unzipping and publishing can run independently (inspect or
tweak the staged site in between):

| Script           | Input             | Output                  | Does                                                                          |
| ---------------- | ----------------- | ----------------------- | ----------------------------------------------------------------------------- |
| **`prepare.sh`** | a zip (or newest) | a clean site dir (path) | extract, promote entry to `index.html`, drop cruft + excludes, optional build |
| **`publish.sh`** | a prepared dir    | a `gh-pages` deploy     | add `CNAME` + `.nojekyll` + `404.html`, force-push as one fresh commit        |
| **`deploy.sh`**  | a zip (or newest) | a `gh-pages` deploy     | `prepare.sh` then `publish.sh`                                                |

`prepare.sh` prints **only the prepared directory path** on stdout (everything
else is on stderr), so you can capture it:

```sh
SITE="$(deploy/prepare.sh)"      # extract + clean the newest zip
ls "$SITE"                        # poke around, run checks, whatever
deploy/publish.sh "$SITE"         # ship it
```

## What `prepare.sh` does

1. Resolves the zip: the first argument, or the newest `*.zip` in the repo root.
2. Extracts it and finds the site root: the folder containing `index.html`. If
   there's **no `index.html` but exactly one HTML file** (design-tool exports
   often name the entry `<Title>.html`), that file is **moved** to `index.html`.
   Several HTML files with no `index.html` is ambiguous, so it stops and lists
   them.
3. Removes macOS cruft (`__MACOSX`, `.DS_Store`) and the excluded paths.
4. Optionally runs `--build "CMD"` inside the site dir.

Flags:

| Flag                    | Effect                                                                        |
| ----------------------- | ----------------------------------------------------------------------------- |
| `--exclude PATTERN`     | Drop paths relative to the site root (glob ok). Repeatable; adds to defaults. |
| `--no-default-excludes` | Keep the default-excluded design-process files.                               |
| `--build "CMD"`         | Run `CMD` in the site dir before publishing (napkin exports need no build).   |
| `--out DIR`             | Stage into `DIR` instead of a temp dir.                                       |

**Default excludes** (design-process files in napkin-style exports, none of
which the app references): `docs`, `scraps`, `uploads`, `.thumbnail`.

## What `publish.sh` does

Works on a **copy** of the prepared dir (your input is never modified), adds the
`CNAME`, a `.nojekyll` marker, and a `404.html` SPA fallback, then force-pushes
to `gh-pages` as a single fresh commit. It builds a throwaway git repo in a temp
dir and pushes that to `origin`, so your working tree and every other branch are
left alone. Flags: `--no-spa-fallback`, `--dry-run`. To target another branch
once, set `DEPLOY_BRANCH=some-branch` in the env.

## Napkin-style design-tool exports

The export bundles the running app (an entry `<Title>.html` that loads React +
Babel from a CDN and transpiles the `.jsx` in the browser, plus `app/`, `_ds/`,
`assets/`) alongside design-process files that aren't part of the app. The
defaults already handle this shape: the entry is promoted to `index.html`,
`docs`/`scraps`/`uploads`/`.thumbnail` are excluded, and `.nojekyll` keeps the
`_ds/` design-system folder from being hidden by Jekyll. So a plain
`deploy/deploy.sh` is all it takes.

## Why `.nojekyll` and the SPA 404 fallback

GitHub Pages runs Jekyll by default, which **hides leading-underscore paths** (it
would 404 the entire `_ds/` design system); `.nojekyll` disables that. Pages
also has **no rewrite engine** (unlike Netlify's `/* -> /index.html`), so a
direct hit on a client-side route would 404; serving the app shell as `404.html`
lets the in-page router boot. The status line is still 404, which is fine for a
prototype; revisit if this graduates to production.

## One-time setup (already done, recorded here)

1. **Pages enabled** to build from the `gh-pages` branch, root folder.
2. **Custom domain** picked up automatically from the `CNAME` file in the branch.
3. **DNS:** one record in **Squarespace DNS** (that's where `sti.care`'s
   nameservers point: `nse1-4.squarespacedns.com`; the Netlify apex is reached
   via an A record, but DNS itself is managed at Squarespace, not Netlify):

   | Type  | Host   | Data / Value         |
   | ----- | ------ | -------------------- |
   | CNAME | `labs` | `obartra.github.io.` |

4. **Enforce HTTPS** is on (the Let's Encrypt cert provisioned once DNS resolved).

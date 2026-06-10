# Prototype deploys to GitHub Pages

`sti.care` (the apex) stays on Netlify. This folder is a **separate** pipeline
that publishes a prototype zip to a custom subdomain via GitHub Pages, on the
`gh-pages` branch.

- **Custom domain:** [`lab.sti.care`](https://lab.sti.care/) (set in [`CNAME`](CNAME))
- **Branch:** `gh-pages` (orphan; every deploy replaces it entirely)
- **Source of truth:** whatever zip you hand over. Nothing here is built from
  the repo; `main` and Netlify are untouched.

## Deploying a zip

```sh
deploy/deploy-gh-pages.sh path/to/prototype.zip
```

That single command:

1. Extracts the zip and finds the folder containing `index.html` (it doesn't
   matter whether the zip wraps the files in a top-level folder).
2. Strips macOS zip cruft (`__MACOSX`, `.DS_Store`).
3. Adds the `CNAME` (custom domain), a `.nojekyll` marker (so `/src` and any
   `_underscore` files survive), and a `404.html` SPA fallback.
4. Force-pushes the result to `gh-pages` as one fresh commit, so the **prior
   `gh-pages` history is discarded** every time.

It builds a throwaway git repo inside a temp dir and pushes that to `origin`, so
your working tree and every other branch are left alone.

Useful flags:

| Flag                | Effect                                                       |
| ------------------- | ------------------------------------------------------------ |
| `--dry-run`         | Prepare the tree and print it, but don't push.               |
| `--no-spa-fallback` | Don't synthesize `404.html` (use for true multi-page sites). |

To deploy to a different branch once, set `DEPLOY_BRANCH=some-branch` in the env.

## Why the SPA 404 fallback

GitHub Pages serves static files and has **no rewrite engine** (unlike Netlify's
`/* -> /index.html` rule). A direct hit on a client-side route such as
`lab.sti.care/hiv` would otherwise 404. Copying the app shell to `404.html` lets
the in-page router boot and render the right view. The status line is still 404,
which is fine for a prototype; revisit if this graduates to production.

## One-time setup (already done, recorded here)

1. **Pages enabled** to build from the `gh-pages` branch, root folder.
2. **Custom domain** picked up automatically from the `CNAME` file in the branch.
3. **DNS:** add one record in **Squarespace DNS** (that's where `sti.care`'s
   nameservers point: `nse1-4.squarespacedns.com`; the Netlify apex is reached
   via an A record, but DNS itself is managed at Squarespace, not Netlify):

   | Type  | Host  | Data / Value         |
   | ----- | ----- | -------------------- |
   | CNAME | `lab` | `obartra.github.io.` |

   Until that record exists and propagates, GitHub can't validate the domain or
   issue the HTTPS certificate, so `lab.sti.care` won't resolve yet.

4. After the cert provisions, enable **Enforce HTTPS** in the repo's
   Settings -> Pages.

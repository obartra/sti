# info.sti.care

The static STI education library, split out of the app so it can grow on its own
cadence (doc 34). Plain Astro, markdown content, no client framework, no service
worker.

## Content

- **Condition explainers**: one markdown file per condition in
  `src/content/conditions/{id}.md`. The filename is the URL slug
  (`info.sti.care/{id}`). Frontmatter is the display name, status label, tone,
  sort order, the "how to test" line, and the intro; the body is the question and
  answer copy. Add a condition by adding a file.
- **Index framing** (prevention, vaccines, testing) and the shared labels:
  `src/data/library.ts`.
- **U=U page** copy: `src/data/uu.ts`, rendered by `src/pages/uu.astro`.
- **Resource links** (CDC and friends): `src/data/resources.ts`, kept in step with
  the app's `passport/src/lib/resources.ts`.

All copy follows the voice guide (`labs/docs/21-voice-and-tone.md`). Branding comes
from the app's design tokens, imported in `src/layouts/Base.astro`, so the palette
and type are a single source of truth, never a duplicated theme.

## Commands

| Command              | Description                                    |
| -------------------- | ---------------------------------------------- |
| `npm run dev`        | Astro dev server                               |
| `npm run build`      | Build static site to `dist/`                   |
| `npm run preview`    | Serve the built site locally                   |
| `npm run check`      | `astro check` (types + content schema)         |
| `npm run lint:voice` | Fail on banned vocabulary or em dashes in copy |
| `npm test`           | `check` + `lint:voice`                         |

## Deploy

Its own Netlify site with the base directory set to `info` (see `netlify.toml`).
DNS: a `CNAME` for `info` on the `sti.care` zone points at the Netlify site.

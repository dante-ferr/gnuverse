# Code and invariants

How the blog is wired today. For the C/Node → Next/Payload mental model, see also [Repository map](../architecture/overview.md).

## Build vs browser

- Without `'use client'`: runs at build time; may read `.content/articles.json` (`src/lib/articles.ts`, `server-only`).
- With `'use client'`: runs in the browser; may `fetch` the CMS; no disk or secrets.
- Payload collections (`cms/src/collections/*.ts`): schema + access + hooks → REST and `/admin`.

## Files

| Path | Role |
| :--- | :--- |
| `src/app/blog/page.tsx` | `/blog/`: explorer + submission |
| `src/app/artigos/` | Static list and `[slug]`; back link to `/blog/` |
| `src/components/blog/blog-explorer.tsx` | Category filter and cards with covers (no runtime HTTP) |
| `src/components/blog/submission-panel.tsx` | Drafts and review status (auth should redirect to dedicated pages) |
| `src/lib/blog-submission.ts` | Text ↔ Lexical, validation, HTTP errors |
| `scripts/sync-content.mjs` | Public API → `.content/` + `public/cms-media/` |
| `cms/src/collections/Articles.ts` | Fields, `owner`, `reviewStatus`, publish hooks |
| `cms/src/collections/Users.ts` | Auth; admin bootstrap; public signup → `author` |
| `cms/src/access.ts` | `admin` / `reviewer` / `author` rules |
| `cms/src/hooks/deploy-site.ts` | Deploy-hook POST when published content changes |
| `cms/scripts/seed-blog-demo.ts` | Idempotent local CMS seed (`make cms-seed`, also used by `make test-blog`) |
| `cms/scripts/reset-local-db.mjs` | Deletes local SQLite DB (+ WAL/SHM) and media (`make cms-reset`) |

## Invariants

1. Anonymous reads only `_status: published`; `reviewNotes` do not leak on the public API.
2. `author` edits only own `owner`; cannot publish; cannot set `approved` / `changes_requested` (except leaving an existing `changes_requested` unchanged).
3. `reviewer`/`admin` review, publish, and delete.
4. Lexical body without `upload`/`relationship` blocks; links only `http(s)`, `mailto`, or relative paths.
5. Covers: required `alt` and credit on `Media`.
6. `CMS_ALLOWED_ORIGINS` enables CORS/CSRF for the static site talking to the CMS.
7. `live` mode: CMS failure aborts sync/build — no silent fallback to the demo article.

## One-command test

```bash
make cms-seed       # apply demo users, covers, and articles
make cms-reset      # wipe local CMS SQLite DB and media
make cms-fresh      # reset, then seed
make test-blog      # seed + E2E + browser
make test-blog-ci   # suite only, no browser
```

Seed accounts (password `gnuverse123`): `admin@gnuverse.local`, `revisor@gnuverse.local`, `autora@gnuverse.local`, `autor2@gnuverse.local`. The seed also creates covers and articles in several editorial states. With `NEXT_PUBLIC_BLOG_TEST_UI=1`, shortcuts on `/blog/?autotest=1` (test UI stripped from normal builds).

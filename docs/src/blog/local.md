# Local CMS and blog testing

No cloud accounts: CMS on SQLite (`cms/data/gnuverse.db`), media under `cms/media/`, game under `.content/game.sqlite`.

## Setup

```bash
make setup   # npm ci, env files, bootstrap CMS DB + HOST_ADMIN_* + demo seed if missing
make check
make dev
```

`make setup` copies `cms/.env.example` to `cms/.env` when missing (fills `PAYLOAD_SECRET`), forces `CMS_CONTENT_MODE=live` in `.env.local`, and creates the local SQLite database with the `HOST_ADMIN_*` account and demo seed when the DB file is absent. Root `.env.example` ships as `demo` — do not copy that example by hand if you want to work against a running CMS. `make cms-reset` wipes that DB and seeds again.

`make dev` injects `live` into the child process. Standalone `make sync`, `make site`, and `make build` read the file: if it says `demo`, they use `content/demo-article.json`.

## Ports

`CMS_PORT` in `.env.local` is the single source for the local CMS port (default `3001`). Leave `CMS_URL` and `CMS_SERVER_URL` empty locally. Override per run:

```bash
CMS_PORT=3011 SITE_PORT=3010 GAME_PORT=3012 make dev
```

Do not run two `next dev` sessions in the same folder.

## Manual steps

1. Open `http://localhost:3001/admin` and sign in with `HOST_ADMIN_*` from `cms/.env` (defaults in `cms/.env.example`), or use a demo account from the seed (`gnuverse123`). `make setup` creates that data when the local DB is missing; a later empty start of the CMS still creates `HOST_ADMIN_*`.
2. Use the seeded reviewer, or create one under **Members**, or run `make test-blog`.
3. Create an article (sample data in `content/demo-article.json`): save as draft; in a private window, `GET /api/articles` must not list it; publish and check again.
4. Optional cover under **Images** (JPEG/PNG/WebP ≤ 5 MB, `alt` + credit).
5. With CMS up: `make sync` or `make build`. Stop the CMS and run `make preview` — `/blog/` and the article should still work from `out/`.

Publishing does **not** refresh an already open `next dev`: run `make sync` or restart the site.

## Production credentials (reference)

Do not commit secrets. Templates live in `.env.example` and `cms/.env.example`.

| Variable | Where |
| :--- | :--- |
| `PAYLOAD_SECRET`, `HOST_ADMIN_*`, `DATABASE_*`, `STORAGE_*` / `S3_*`, `CMS_SERVER_URL`, `CMS_ALLOWED_ORIGINS`, `SITE_DEPLOY_HOOK_URL`, `SMTP_*`, `GNUVERSE_SITE_URL` | Render (`cms/`) |
| `CMS_CONTENT_MODE=live`, `CMS_URL`, `NEXT_PUBLIC_CMS_URL`, `NEXT_PUBLIC_GAME_API_URL` | Cloudflare Pages |

Do not use `SUPABASE_ANON_KEY` / `SERVICE_ROLE` in this design. Account walkthrough: [Cloud](cloud.md).

# GNUverse

Multimodal MATA68 project (2026.2): free software as a way to democratize access to technology. Stack: Next.js App Router, Tailwind, and TypeScript.

Team method (architecture, blog, game, planning, roadmap):

```bash
make docs-serve
```

Opens the book at `http://localhost:3003`. Course brief: `docs/references/trabalho-multimodal-2026.2.pdf`.

UI copy is Portuguese; code and documentation are English (`AGENTS.md`).

## Experience

- **Collaborative Open Pipeline rooms** (`/jogo/`): shared grid logistics with belts, cores, and room chat; create or join at `/jogo/sala/?id=`. Backend in `game-server/`; production hosting still open.
- **Authorial blog** (`/blog/`, `/artigos/`): team and visitor posts with approval. `author` / `reviewer` / `admin` flow and submission panel are in code; 14 posts and cloud setup are still pending.
- **Learning quizzes** (`/quizzes/`): contributors create independent quizzes or link them to articles; reviewers publish through the CMS. Visitors answer without signing in. See [Quizzes](docs/src/blog/quizzes.md), or run `make test-quiz` for the focused checks.

Single account in Payload; roles in `core/authz/` and **People and access** on the CMS. Detail: book → Authorization.

## Architecture

Static site (Cloudflare Pages) + Payload (`cms/`, Render Free) + `game-server/` (always on + disk). Content lives in database/storage; publish triggers a deploy hook; readers do not wait for the CMS to wake.

## Local setup

Requires Node.js 22.18+, npm, and GNU Make.

```bash
make setup
make dev
```

`make setup` installs dependencies, copies `cms/.env.example` to `cms/.env` when missing (fills `PAYLOAD_SECRET`), prepares `.env.local` for a live CMS, and bootstraps the local CMS database when it is missing (creates the `HOST_ADMIN_*` account and demo seed).

`make dev` (or `make cms`) starts the CMS. Defaults for the host admin in `cms/.env.example`:

| Variable | Default |
| :--- | :--- |
| `HOST_ADMIN_EMAIL` | `admin@gnuverse.local` |
| `HOST_ADMIN_PASSWORD` | `gnuverse123` |
| `HOST_ADMIN_NAME` | `Administrador` |
| `HOST_ADMIN_USERNAME` | `admin` |

Sign in at `/admin` or `/login` with those credentials. Change them in `cms/.env` before the first local bootstrap, or run `make cms-set-host-admin` to apply `HOST_ADMIN_*` to an existing database (including production).

`HOST_ADMIN_*` creates the administrator only when the users table is empty. Editing those variables on a server that already has users does not change the password — use `make cms-set-host-admin` (Render Shell: `cd cms && npm run set-host-admin`).

`make cms-reset` wipes the local SQLite DB and media, then applies the demo seed. If the CMS is still running, stop and restart it so it opens the new database file.

Ctrl+C stops CMS, game, and site. Useful commands: `make test-blog`, `make check`, `make build`, `make preview`, `make cms-reset`, `make mailpit`, `make help`.

Default ports: site `3000`, CMS `3001`, game `3002`. Override per run: `CMS_PORT=3011 SITE_PORT=3010 GAME_PORT=3012 make dev`.

## Local email (Mailpit)

Signup and password recovery send mail over SMTP. `make dev` does not start a mail server. Without one, confirmation fails and the account is not kept.

```bash
make mailpit
```

Open the inbox at `http://127.0.0.1:8025` (or the URL printed by `make mailpit`). SMTP listens on `127.0.0.1:1025` (`SMTP_HOST` and `SMTP_PORT` in `cms/.env`). If another process already owns 8025, `make mailpit` publishes the UI on 8026 instead, or use `MAILPIT_UI_PORT=8026 make mailpit`. Confirmation links point at the site (`/verificar-email/`). `make dev` prints the default UI address when it starts.

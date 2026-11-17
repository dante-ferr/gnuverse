# GNUverse

Multimodal MATA68 project (2026.2): free software as a way to democratize access to technology. Stack: Next.js App Router, Tailwind, and TypeScript.

Team method (architecture, blog, game, planning, roadmap):

```bash
make docs-serve
```

Opens the book at `http://localhost:3003`. Course brief: `docs/references/trabalho-multimodal-2026.2.pdf`.

UI copy is Portuguese; code and documentation are English (`AGENTS.md`).

## Experience

Two independent areas:

- **Collaborative towers** (`/jogo/`): local multiplayer with physics, coins, votes, and BDFL. Backend in `game-server/`; production hosting still open.
- **Authorial blog** (`/blog/`, `/artigos/`): team and visitor posts with approval. `author` / `reviewer` / `admin` flow and submission panel are in code; 14 posts and cloud setup are still pending.

Single account in Payload; roles in `core/authz/` and **People and access** on the CMS. Detail: book → Authorization.

## Architecture

- Static site (Cloudflare Pages) + Payload (`cms/`, Render Free) + `game-server/` (always on + disk).
- Content in database/storage; publish triggers a deploy hook; readers do not wait for the CMS to wake.

## Local testing

Node.js 22.18+, npm, GNU Make.

```bash
make setup
make dev
```

Ctrl+C stops CMS, game, and site. Shortcuts: `make test-blog`, `make check`, `make build`, `make preview`, `make help`.

Default ports: site `3000`, CMS `3001`, game `3002`. Alternatives: `CMS_PORT=3011 SITE_PORT=3010 GAME_PORT=3012 make dev`.

## Layout

| Folder | Role |
| :--- | :--- |
| `src/` | Site (blog, articles, game) |
| `cms/` | Payload, users, media, migrations |
| `game-server/` | API, physics, game SQLite |
| `core/` | Pure authz/authn |
| `scripts/` | Dev, sync, E2E tests |
| `docs/` | mdBook + `references/` |

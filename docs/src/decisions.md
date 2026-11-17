# Locked decisions

Records what the team chose (2026-10-14; scope updated 2026-11-15–16). Where a phrase was ambiguous, the reading below applies.

## 1. Two independent areas

GNUverse has **Open Pipeline** and an **authorial blog**. Posts are not rooms; playing does not require publishing; publishing does not change the game.

## 2. Static site + dynamic backends

- Public site: Next.js App Router with `output: "export"`, Cloudflare Pages.
- Blog / identity / media: Payload in `cms/`, planned on Render Free.
- Game: `game-server/` (`node:http`, `node:sqlite`, grid tick in `pipeline/`, SSE — not Matter.js for the match), hosting that stays **always on** with persistent disk (Render Free is not enough). Routes stay `/jogo/` and `/jogo/torre/?id=` / `/api/towers`.

## 3. Content outside Git

Articles and covers live in the database/storage. Publishing triggers a deploy hook; the build reads published items only, copies covers to `public/cms-media/`, and writes `.content/articles.json`. Code, schemas, and migrations stay versioned.

## 4. Mandatory editorial flow

Roles `author` / `reviewer` / `admin`. Authors submit via `/blog/`; only reviewer/admin publish in `/admin`. Flow: `draft` → `in_review` → `changes_requested` or `approved` → `_status: published`.

## 5. Single account

Canonical registration and session live in Payload. The game does not store passwords; `CMSIdentityProvider` validates each login. Shared roles (`admin`, `blog-editor`, `game-moderator`, …) live in `core/authz/` and in the **People and access** UI (`/acessos` on the CMS host).

## 6. Human authorship

Seven members; 14 initial posts (two each). AI may support code and scaffolding; texts, sources, and logbook reflections stay human.

## 7. Accepted limits

CMS cold start on Render Free; delay until the Cloudflare build finishes; hook without queue/retry; build quotas; public media library on the API; cloud not yet validated in production.

## 8. Language and auth UX

UI copy is Portuguese. Code and docs are English. Sign-in and registration use dedicated pages — no inline auth forms at the call site. See `AGENTS.md`.

## Still open

| Item | When it resolves |
| :--- | :--- |
| Supabase / Render / Cloudflare accounts and a real publish cycle | Before opening the site to the public |
| SMTP and anti-spam for broad registration | Before advertising external signup |
| `game-server` hosting with a volume | Before `/jogo/` in production |
| 14 posts + logbook + accessibility | By delivery (2026-12-02) |
| Aligned human editorial criteria | Before batch publishing |

Operational detail: [Roadmap](engineering/roadmap.md).

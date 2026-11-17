# Roadmap

Open work only. Shipped behavior lives in the didactic chapters and in [history](history.md) — do not repeat it here.

## 1. Blog cloud

Create Supabase (Postgres + S3), Render (`cms/`), Cloudflare Pages, `CMS_ALLOWED_ORIGINS`, deploy hook. Validate publish → build → cover → unpublish. Guide: [Cloud](../blog/cloud.md).

**Accept:** full production cycle with documented cold start.

## 2. SMTP and open signup

Payload SMTP adapter; rate limit / anti-spam on public registration before wide advertising.

## 3. Game-server hosting

Always-on provider + volume; `GAME_HOST`, `GAME_DB_PATH`, CORS, `NEXT_PUBLIC_GAME_API_URL` + site redeploy. Guide: [Production](../game/production.md).

## 4. Content and academic delivery

Team accounts; 14 reviewed posts; a11y/mobile; collective and individual logbook. Freeze by 30 Nov; deliver 2 Dec 17:00.

## 5. Human editorial criteria

Align what reviewers require (sources, tone, cover) beyond API locks.

## 6. Dedicated auth pages

Move login and registration off inline panels into shared pages; every “sign in / register” control redirects there (`AGENTS.md`).

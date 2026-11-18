# Roadmap

Open work only. Shipped behavior lives in the didactic chapters and in [history](history.md) — do not repeat it here.

## 1. Blog cloud

Create Supabase (Postgres + S3), Render (`cms/`), Cloudflare Pages, `CMS_ALLOWED_ORIGINS`, deploy hook. Validate publish → build → cover → unpublish. Guide: [Cloud](../blog/cloud.md).

**Accept:** full production cycle with documented cold start.

## 2. Open signup hardening

Production SMTP (auth/TLS), confirmation site URL, registration rate limit, and `make cms-set-host-admin` are in place. Still open before wide advertising: CAPTCHA or equivalent anti-spam.

## 3. Game-server hosting

Always-on provider + volume; `GAME_HOST`, `GAME_DB_PATH`, CORS, `NEXT_PUBLIC_GAME_API_URL` + site redeploy. Guide: [Production](../game/production.md).

## 4. Content and academic delivery

Team accounts; 14 reviewed posts; a11y/mobile; collective and individual logbook. Freeze by 30 Nov; deliver 2 Dec 17:00.

## 5. Human editorial criteria

Align what reviewers require (sources, tone, cover) beyond API locks.

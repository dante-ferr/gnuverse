# Cloud (Supabase + Render + Cloudflare)

None of this has been validated with real accounts yet. It is service configuration, not new application code.

## Why three services

| Service | Role | Free-tier limit | How the design responds |
| :--- | :--- | :--- | :--- |
| Supabase | Postgres + S3 | — | Persistence outside Render’s disk |
| Render Free | Node process for `cms/` | Sleeps; wipes disk | Readers do not need the CMS awake; production requires Postgres/S3 |
| Cloudflare Pages | Static `out/` | No long-running Node; build quota | Visitors hit the CDN; builds run on publish |

In production, `cms/src/payload.config.ts` aborts if `DATABASE_ADAPTER=postgres` and `STORAGE_ADAPTER=s3` are missing.

## 1. Supabase

1. Dedicated project.
2. `DATABASE_URL`: Session pooler, port 5432, IPv4 (Render free often fails on direct IPv6).
3. Private bucket (e.g. `gnuverse-media`); create S3 keys (`S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, endpoint, region).
4. Payload proxies `/api/media`; sync only downloads covers whose origin matches `CMS_URL`.

## 2. Render (`cms/`)

- Root Directory: **`cms`**
- Node 22+, Free
- Build: `npm ci && npm run generate:importmap && npm run build`
- Start: `npm run migrate && npm start` (`push: false` — schema only via versioned migrations)
- Env: `NODE_ENV=production`, stable `PAYLOAD_SECRET`, `CMS_SERVER_URL` (HTTPS without `/admin`), Postgres/S3, then `SITE_DEPLOY_HOOK_URL` and `CMS_ALLOWED_ORIGINS` (Pages URL, no trailing slash)

Create the `admin` **before** sharing the URL.

## 3. Cloudflare Pages

- Root: `/`; build `npm run build`; output `out/`
- `CMS_CONTENT_MODE=live`, `CMS_URL`, `NEXT_PUBLIC_CMS_URL` (CMS HTTPS URL)
- Deploy hook → `SITE_DEPLOY_HOOK_URL` on Render
- Validate: submit on `/blog/`, review/publish, edit, unpublish, delete, cover

## Accepted risks

- Cold start up to ~120 s on build and submission path.
- An unpublished article stays live until the next deploy finishes.
- Hook: one POST, 10 s, no retry — failure needs a manual deploy.
- Editing media alone does not trigger a build; republish the article.
- Batch reviews before mass publishing (build quota).

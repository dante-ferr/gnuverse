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
- Env: `NODE_ENV=production`, stable `PAYLOAD_SECRET`, `HOST_ADMIN_EMAIL` / `HOST_ADMIN_PASSWORD` / `HOST_ADMIN_NAME` / `HOST_ADMIN_USERNAME` (unique production password), `CMS_SERVER_URL` (HTTPS without `/admin`), Postgres/S3, then `SITE_DEPLOY_HOOK_URL` and `CMS_ALLOWED_ORIGINS` (Pages URL, no trailing slash)
- Mail (required for signup / password recovery): `SMTP_HOST`, `SMTP_PORT` (`587` or `465`), `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_ADDRESS`, `SMTP_FROM_NAME`, and `GNUVERSE_SITE_URL` (public HTTPS origin of the static site — used in confirmation links). Set `SMTP_SECURE=true` for port 465; leave empty for STARTTLS on 587.

On first start with an empty database, the CMS creates the host `admin` from `HOST_ADMIN_*`. Set those variables **before** sharing the URL. Changing `HOST_ADMIN_*` later does **not** update the existing account.

### Redefine the host admin

On the Render Shell (or any host with the production env loaded):

```bash
cd cms
# Optional when changing the admin e-mail: HOST_ADMIN_MATCH_EMAIL=current@example
npm run set-host-admin
```

From the repo root: `make cms-set-host-admin` / `npm run cms:set-host-admin`. The command reads `HOST_ADMIN_*` from the environment, updates the matched admin (or creates one if none exists), and marks the account verified.

## 3. Cloudflare Pages / Vercel

- Root: `/`; build `npm run build`; output `out/`
- `CMS_CONTENT_MODE=live`, `CMS_URL`, `NEXT_PUBLIC_CMS_URL` (CMS HTTPS URL), `GNUVERSE_SITE_URL` only on the CMS — not required on Pages
- Deploy hook → `SITE_DEPLOY_HOOK_URL` on Render
- **Public signup and login without `game-server`:** `/cadastro/` and `/login/` authenticate directly against `NEXT_PUBLIC_CMS_URL` whenever `NEXT_PUBLIC_GAME_API_URL` is unset off-localhost, so accounts work with only the CMS hosted.
- Validate: submit on `/blog/`, review/publish, edit, unpublish, delete, cover

## Accepted risks

- Cold start up to ~120 s on build and submission path.
- An unpublished article stays live until the next deploy finishes.
- Hook: one POST, 10 s, no retry — failure needs a manual deploy.
- Editing media alone does not trigger a build; republish the article.
- Batch reviews before mass publishing (build quota).

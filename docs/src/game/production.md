# Game-server production

The Cloudflare/Vercel build includes `/jogo/`. Until `game-server` is hosted and `NEXT_PUBLIC_GAME_API_URL` is set, `/cadastro/` and `/login/` fall back to authenticating directly against the CMS (`NEXT_PUBLIC_CMS_URL`) off-localhost instead of calling `http://localhost:3002`. Once the game backend is ready, host it and point the URL:

## Requirements

1. **Always-on process** + **persistent volume**. Render Free is not enough (suspends SSE/timers and wipes disk).
2. **One instance**: match state in RAM; `database-lock.ts` enforces a single SQLite writer.
3. `GAME_HOST=0.0.0.0` and provider `GAME_PORT` (local default is `127.0.0.1`).
4. `GAME_DB_PATH` on the volume (e.g. `/data/game.sqlite`); keep the `.writer-lock`.
5. `GAME_ALLOWED_ORIGINS` = Pages HTTPS URL (no trailing slash).
6. `NEXT_PUBLIC_GAME_API_URL` on Cloudflare **and a site redeploy** (value is fixed at build time).
7. HTTPS in front of the game (no mixed content); proxy with long timeouts and `X-Accel-Buffering: no` for SSE.
8. `NODE_ENV=production`.

Identity still comes from the CMS: set a `CMS_URL` the game-server can reach.

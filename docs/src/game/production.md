# Game-server production

The Cloudflare build includes `/jogo/`. The local backend already exists; you still need to host it and point the URL.

## Requirements

1. **Always-on process** + **persistent volume**. Render Free is not enough (suspends SSE/timers and wipes disk).
2. **One instance**: simulation state in RAM; `database-lock.ts` enforces a single SQLite writer.
3. `GAME_HOST=0.0.0.0` and provider `GAME_PORT` (local default is `127.0.0.1`).
4. `GAME_DB_PATH` on the volume (e.g. `/data/game.sqlite`); keep the `.writer-lock`.
5. `GAME_ALLOWED_ORIGINS` = Pages HTTPS URL (no trailing slash).
6. `NEXT_PUBLIC_GAME_API_URL` on Cloudflare **and a site redeploy** (value is fixed at build time).
7. HTTPS in front of the game (no mixed content); proxy with long timeouts and `X-Accel-Buffering: no` for SSE.
8. `NODE_ENV=production`; infinite coins stay off in that mode.

Identity still comes from the CMS: set a `CMS_URL` the game-server can reach.

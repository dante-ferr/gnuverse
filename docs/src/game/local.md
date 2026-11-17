# Local game testing

```bash
make dev
```

Open `http://localhost:3000/jogo/`. Default API: `http://localhost:3002`. The CMS must be up for authenticated signup/login. `CMS_CONTENT_MODE=demo` only affects the blog, not the game.

Separated:

```bash
npm run game:dev   # terminal 1
npm run dev        # terminal 2 (site)
```

## Accounts

Use the panel account or register through the site auth pages (email, password, public nickname). No email verification or SMTP recovery in this delivery. Test with two sessions (private window) on the same tower.

## Variables

| Variable | Use |
| :--- | :--- |
| `GAME_PORT` / `GAME_HOST` | HTTP (default `3002` / `127.0.0.1`) |
| `GAME_DB_PATH` | SQLite (default `.content/game.sqlite`) |
| `GAME_ALLOWED_ORIGINS` | Browser origins |
| `GAME_CONFIG_PATH` | Optional TOML |
| `GAME_INFINITE_COINS=true` | Outside production only |
| `NEXT_PUBLIC_GAME_API_URL` | URL baked into the client |

Include the site origin in `GAME_ALLOWED_ORIGINS`. On LAN: `GAME_HOST=0.0.0.0` and a reachable URL in `NEXT_PUBLIC_*`.

## Prototype limits

Single instance; `.writer-lock` beside the DB (do not delete while the server runs). Configurable caps (e.g. 200 towers, 10/account, 100 blocks, 100 SSE viewers). In-memory login rate limit. No history pagination. Do not treat this as a public-ready service.

## Wind and physics (summary)

Thresholds in blocks (`wind_*` in TOML). At the threshold, block new pieces, apply wind ~5 s, wait to stabilize. Restore during wind may defer execution. Periodic checkpoints; changing the interval does not cancel a pending checkpoint. Operational detail stays in code and TOML.

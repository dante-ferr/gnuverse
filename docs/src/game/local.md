# Local game testing

```bash
make setup
make dev
```

Open `http://localhost:3000/jogo/`. Default API: `http://localhost:3002`. The CMS must be up so you can sign in before placing or removing belts. `CMS_CONTENT_MODE=demo` only affects the blog, not the game.

Separated:

```bash
npm run game:dev   # terminal 1 — one instance only (SQLite lock)
npm run dev        # terminal 2 (site)
```

Do not start a second `npm run game:dev` while one is running (SQLite: "Já existe uma instância do jogo usando este banco.").

## Accounts

Use the panel account or register through the site auth pages (email, password, public nickname). Sign-in and registration use dedicated pages — not inline forms in the lobby or room. Test with two sessions (private window) in the same room.

For local confirmation and password-recovery email, run `make mailpit` and open `http://127.0.0.1:8025`.

## Variables

| Variable | Use |
| :--- | :--- |
| `GAME_PORT` / `GAME_HOST` | HTTP (default `3002` / `127.0.0.1`) |
| `GAME_DB_PATH` | SQLite (default `.content/game.sqlite`) |
| `GAME_ALLOWED_ORIGINS` | Browser origins |
| `GAME_CONFIG_PATH` | Optional TOML path |
| `NEXT_PUBLIC_GAME_API_URL` | URL baked into the client |

Include the site origin in `GAME_ALLOWED_ORIGINS`. On LAN: `GAME_HOST=0.0.0.0` and a reachable URL in `NEXT_PUBLIC_*`.

## Smoke checks

```bash
node --test tests/pipeline-tick.test.ts tests/pipeline-http.test.ts tests/game-config.test.ts
```

Manual: create or open a room at `/jogo/torre/?id=`, place belts while signed in, confirm packets move and the core readout updates.

## Prototype limits

Single instance; `.writer-lock` beside the DB (do not delete while the server runs). Legacy rooms without `kind: "pipeline"` are hidden from the list. Do not treat this as a public-ready service.

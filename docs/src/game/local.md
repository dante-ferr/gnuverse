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

Use the panel account or register through the site auth pages (email, password, unique public nickname). Sign-in accepts email or nickname plus password. Sign-in and registration use dedicated pages — not inline forms in the lobby or room. Test with two sessions (private window) in the same room.

For local confirmation and password-recovery email, run `make mailpit` and open the URL it prints (`http://127.0.0.1:8025` by default; `8026` if that port is already taken).

## Variables

| Variable | Use |
| :--- | :--- |
| `GAME_PORT` / `GAME_HOST` | HTTP (default `3002` / `127.0.0.1`) |
| `GAME_DB_PATH` | SQLite (default `.content/game.sqlite`) |
| `GAME_ALLOWED_ORIGINS` | Browser origins |
| `GAME_CONFIG_PATH` | Optional path to the entry TOML (`game.config.toml`); sibling `pipeline.toml` and `elements.toml` load from the same directory |

While `npm run game:dev` is running, edits to `game-server/config/pipeline.toml`, `game.config.toml`, or `elements.toml` (or the directory of `GAME_CONFIG_PATH`) hot-reload gameplay and presentation numbers—colors, tick interval, and related knobs—without restarting the server. Invalid TOML or validation errors are logged and ignored until the file is fixed; connected clients receive an update when a reload succeeds. Existing rooms keep the grid size they were created with; changing `grid_width` or `grid_height` affects new rooms only.
| `NEXT_PUBLIC_GAME_API_URL` | URL baked into the client |

Include the site origin in `GAME_ALLOWED_ORIGINS`. On LAN: `GAME_HOST=0.0.0.0` and a reachable URL in `NEXT_PUBLIC_*`.

## Smoke checks

```bash
node --test tests/pipeline-tick.test.ts tests/pipeline-http.test.ts tests/game-config.test.ts
```

Manual: create or open a room at `/jogo/sala/?id=`, place belts while signed in, confirm packets move and the sidebar **Requisitos do núcleo** updates deliveries.

## Prototype limits

Single instance; `.writer-lock` beside the DB (do not delete while the server runs). Legacy rooms without `kind: "pipeline"` are hidden from the list. Do not treat this as a public-ready service.

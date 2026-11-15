<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Cooperative cave-tree game

The public block-tower game was replaced by the cave-tree game described in `game-proposal.md` (written outside this repo; when it conflicts with this repo, the bullets below win). Read [`docs/tree-cli.md`](docs/tree-cli.md) and [`game-server/config/game.config.toml`](game-server/config/game.config.toml) before changing rules.

### Stack and URLs (keep as-is)

- Static lobby at `/jogo/`, room URL `/jogo/torre/?id=<uuid>`, CMS login, separate Node **game-server**, SQLite, server-authoritative state over **SSE**, **Matter.js** (simplified segment physics—not the proposal's full revolute break model).
- Do **not** rename `/jogo/torre/` or `/api/towers`. Do **not** add the proposal's Rust/axum service, WebSockets, in-memory-only store, or standalone `index.html`.
- `npm run game:dev` = game API; `npm run dev` = Next. Do **not** start a second `npm run game:dev` while one is running (SQLite: "Já existe uma instância do jogo usando este banco.").
- Headless play: `npm run game:cli` (see `docs/tree-cli.md`). Login uses the real CMS identity provider; the test identity provider is for unit tests only.

### Economy and energy

- **Wallet:** one coin balance **per account**, spent on every tree action; cap 5, start 5, +1 every 6s—not a shared pot, not per tree (`game.config.toml`).
- **Light energy:** one shared pool per tree (capacity 100, start 40, +8 per functional leaf near a firefly each physics phase, drain 2 per branch segment). Starvation withers unfortified tips and can lose the game.

### Turn loop and actions

- **Phases:** Idle (physics paused until a valid action) → ActionWindow 10s → PhysicsPhase 4s @ 60 Hz → Idle. Concurrent actions apply in arrival order (same node allowed).
- **Grow** is not a button: two canvas clicks—any point on a segment, then the new tip. Buttons: Folha, Fortificar, Podar only. Secondary-root exists on the server API only (no UI). UI copy is Portuguese.
- **Governance** stays per tree, stricter: ban proposals only (restore removed). Any logged-in player may act; voting needs ≥3 accepted actions by that player on that tree.

### Scope, win/lose, config

- This slice is the playable core only—no wind shadow, stalactites, fissures, or mineral drips unless the user asks.
- **Win:** terminal flower plus energy > 0 for 2 consecutive physics phases. **Lose:** trunk gone or total energy starvation as implemented.
- All gameplay and presentation numbers live in `game.config.toml` and reach the client via the rules payload—do not hardcode them in TypeScript.

### Presentation (`src/components/game/construction/tree-scene.tsx`, rules payload)

- Fixed full-viewport canvas; page does not scroll; compact sidebar (rules, community, three buttons). Light background; terrain, tree, and leaves share one dark color.
- Procedural terrain seeded by tree id, spans world width; keep amplitude and max slope low in config so the climb to the exit is not shortened.
- Camera: WASD, arrows, left-drag past config threshold, middle-mouse drag; clamped to world. Root has no parent—the sprout must be drawn from the terrain surface up to the root or it is invisible.

### Agent workflow

- Unset game-design choices: ask the user before inventing rules.
- Prefer a **composer-2.5** subagent for mechanical edits.
- Do not commit unless the user asks.
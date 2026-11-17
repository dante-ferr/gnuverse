# Rules and design

Open Pipeline v0.1 as implemented on `feat/game`. Gameplay numbers live in `[pipeline]` in `game-server/config/game.config.toml` and reach the client on the rules payload — do not hardcode them in TypeScript. Later versions (splitters, nested shapes, satellite cores, victory) wait until the current version is reviewed.

## Role in GNUverse

A playful analogy for collaboration and free-software logistics — independent from the blog. Signing in uses the CMS identity provider. Only a signed-in account can place or delete belts.

## Form and loop

Top-down grid. One circle source and a **5×5** central core. Each face has three input slots on the central tiles; corners are solid (**12** inputs). Players drag unidirectional belts. Each cell holds one packet. Past the tile cap, the oldest belt is removed.

The server moves packets simultaneously. Packets do not swap. An open core slot consumes a circle and counts a delivery. One stability bar for circles: after the grace period, a low delivery rate drains it to a crash. There is no victory screen yet.

## Presentation

Dynamic grid, belts, and packets are canvas drawings. Static machine art is SVG under `public/pipeline/`. In-room copy is Portuguese. Readouts sit on the core, not in a sidebar. Product name **Open Pipeline** stays untranslated in UI and metadata titles.

## Stack constraints (do not invent alternatives)

- Static lobby at `/jogo/`; room at `/jogo/torre/?id=<uuid>`.
- Separate Node `game-server`, SQLite, server-authoritative state over **SSE**.
- The grid tick does **not** use Matter.js.
- Do not rename `/jogo/torre/` or `/api/towers`. Do not add a Rust service, WebSockets, or an in-memory-only store.

## Unset design

Ask before inventing rules that are not in the proposal, WIP handoff, `AGENTS.md`, or TOML.

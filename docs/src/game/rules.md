# Rules and design

Open Pipeline v0.1 as implemented on `feat/game`. Gameplay numbers live in `[pipeline]` in `game-server/config/game.config.toml` and reach the client on the rules payload — do not hardcode them in TypeScript. Later versions (splitters, nested shapes, satellite cores, victory) wait until the current version is reviewed.

## Role in GNUverse

A playful analogy for collaboration and free-software logistics — independent from the blog. Signing in uses the CMS identity provider. Only a signed-in account can place or delete belts.

## Form and loop

Top-down grid. One **3×3** circle source and a **5×5** central core. Each core face has three input slots on the central tiles; corners are solid (**12** inputs). The source emits from a single output on the center of its facing edge. At match start, `map-layout.ts` places the source from the room seed on one of four clearance-separated approaches around the centered core. Map generation reserves non-overlapping rectangular clearance pads around each machine from TOML (`machine_clearance_min`, `core_clearance_extra`); see [Decisions §9](../decisions.md#9-open-pipeline-machines). Players may still place belts on those cells after the match starts. Players drag unidirectional belts. Each cell holds one packet. Past the tile cap, the oldest belt is removed.

The server moves packets simultaneously. Packets do not swap. An open core slot consumes a circle and counts a delivery. There is no stability bar and no crash: the match keeps running. Later versions keep prior packet demands active; without those supplies, leveling up is impossible. There is no victory screen yet.

## Presentation

Dark background, light machine bodies. Machine **bodies** and **slots** are procedural canvas drawings: a cell-fit rectangle plus “[”-shaped slot brackets from `Machine`. Core decor (`core-decor.svg`) is a simple thick-stroke glyph with GNUverse accent details (`color_accent`). Each source shows a clear **resource** SVG for its shape (`resource-circle.svg` in v0.1) and nothing else. Stroke thickness is `decor_stroke_width` in `[pipeline]`. Belts and packets stay procedural. In-room copy is Portuguese. Readouts sit on the core, not in a sidebar. Product name **Open Pipeline** stays untranslated in UI and metadata titles.

Footprints and machine art rules are locked in [Decisions §9](../decisions.md#9-open-pipeline-machines).

## Stack constraints (do not invent alternatives)

- Static lobby at `/jogo/`; room at `/jogo/torre/?id=<uuid>`.
- Separate Node `game-server`, SQLite, server-authoritative state over **SSE**.
- The grid tick does **not** use Matter.js.
- Do not rename `/jogo/torre/` or `/api/towers`. Do not add a Rust service, WebSockets, or an in-memory-only store.

## Unset design

Ask before inventing rules that are not in the proposal, WIP handoff, locked [Decisions §9](../decisions.md#9-open-pipeline-machines), `AGENTS.md`, or TOML.

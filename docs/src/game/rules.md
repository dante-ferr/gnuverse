# Rules and design

Open Pipeline v0.1 as implemented on `feat/game`. Gameplay numbers live in `[pipeline]` in `game-server/config/game.config.toml` and reach the client on the rules payload — do not hardcode them in TypeScript. Later versions (splitters, nested shapes, satellite cores, victory) wait until the current version is reviewed.

## Role in GNUverse

A playful analogy for collaboration and free-software logistics — independent from the blog. Signing in uses the CMS identity provider. Only a signed-in account can place or delete belts.

## Form and loop

Top-down grid. One **3×3** circle source and a **5×5** central core. Each core face has three input slots on the central tiles; corners are solid (**12** inputs). The source emits from a single output on the center of its facing edge. At match start, `map-layout.ts` places the source from the room seed on one of four clearance-separated approaches around the centered core. Map generation reserves non-overlapping rectangular clearance pads around each machine from TOML (`machine_clearance_min`, `core_clearance_extra`); see [Decisions §9](../decisions.md#9-open-pipeline-machines). Players may still place belts on those cells after the match starts. Players drag unidirectional belts. Each cell holds one packet. Past the tile cap, the oldest belt is removed.

The server moves packets simultaneously. Packets do not swap. An open core slot consumes a circle and counts a delivery. There is no stability bar and no crash: the match keeps running. Later versions keep prior packet demands active; without those supplies, leveling up is impossible. There is no victory screen yet.

## Presentation

Dark background; machine **bodies** are procedural cell-fit rectangles plus “[”-shaped slot brackets from `Machine`. Core body uses `color_core` (white); source body uses `color_source` (site accent). Black-ink decor SVGs (`core-decor.svg`, `source-decor.svg`) tint to `color_background` when drawn. The **resource** symbol for each source is screen-space (zoom-independent): fixed pixel size and orbit from `[pipeline]` (`resource_glyph_*`), white stroke with dark outline, animating around the machine center — not stamped on the source body. Stroke thickness in decor art is `decor_stroke_width`. Belts and packets stay procedural. In-room copy is Portuguese. **Core requirements** (version, deliveries, unique collaborators, demanded shapes) live in a room **sidebar** (`CoreRequirementsSidebar`); on narrow viewports the panel sits under the canvas. Git blame on belts stays as a canvas hover label. Product name **Open Pipeline** stays untranslated in UI and metadata titles.

Footprints and machine art rules are locked in [Decisions §9](../decisions.md#9-open-pipeline-machines).

## Stack constraints (do not invent alternatives)

- Static lobby at `/jogo/`; room at `/jogo/torre/?id=<uuid>`.
- Separate Node `game-server`, SQLite, server-authoritative state over **SSE**.
- The grid tick does **not** use Matter.js.
- Do not rename `/jogo/torre/` or `/api/towers`. Do not add a Rust service, WebSockets, or an in-memory-only store.

## Unset design

Ask before inventing rules that are not in the proposal, WIP handoff, locked [Decisions §9](../decisions.md#9-open-pipeline-machines), `AGENTS.md`, or TOML.

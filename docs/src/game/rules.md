# Rules and design

Open Pipeline v0.1 as implemented on `feat/game`. Gameplay numbers live in `[pipeline]` in `game-server/config/game.config.toml` and reach the client on the rules payload — do not hardcode them in TypeScript. Later versions (splitters, nested shapes, satellite cores, victory) wait until the current version is reviewed.

## Role in GNUverse

A playful analogy for collaboration and free-software logistics — independent from the blog. Signing in uses the CMS identity provider. Only a signed-in account can place or delete belts.

## Form and loop

Top-down grid. One **3×3** circle source and a **5×5** central core. Each core face has three input slots on the central tiles; corners are solid (**12** inputs). The source emits from a single output on the center of its facing edge. At match start, `map-layout.ts` places the source from the room seed on one of four clearance-separated approaches around the centered core. Map generation reserves non-overlapping rectangular clearance pads around each machine from TOML (`machine_clearance_min`, `core_clearance_extra`); see [Decisions §9](../decisions.md#9-open-pipeline-machines). Players may still place belts on those cells after the match starts. Players drag unidirectional belts. Each cell holds one packet.

The server moves packets simultaneously. Packets do not swap. When two or three belts feed the same free cell, merge arbitration admits one packet per tick in round-robin order over the inbound sides (stable NESW, at most three inputs; a fourth inbound placement is rejected). Empty inputs are skipped. An open core slot consumes a circle and counts a delivery while that shape’s `received` count is still below its `required` milestone from TOML; once the quota is met, further packets of that shape do not enter the core and remain on the belt. There is no stability bar and no crash: the match keeps running. Later versions keep prior packet demands active; without those supplies, leveling up is impossible. There is no victory screen yet.

## Presentation

Dark background; machine **bodies** are procedural cell-fit rectangles plus “[”-shaped slot brackets from `Machine`, each stroked with `color_outline` at `outline_width_px`. Core body uses `color_core` (white); source body uses `color_source` (site accent). Black-ink decor SVGs (`core-decor.svg`, `source-decor.svg`) tint to a **darker tone of that machine’s body color** (`darkenHex` with `[pipeline] decor_darken_percent`) when drawn. `color_decor` stays in the palette for future UI but is not the overlay tint. Extended palette keys (`color_surface`, `color_muted`, `color_highlight`, and siblings) are in `[pipeline]` TOML for future UI. The **resource** symbol for each source is screen-space (zoom-independent): fixed pixel size and a **subtler** orbit from `[pipeline]` (`resource_glyph_*`), drawn as a filled white disk with the same dark outline — not stamped on the source body. Thick strokes in decor art match `decor_stroke_width`. Belts are fill and chevron only (no outline); track ends are square and stay inside the cell, and chevrons move with the belt until they leave that cell. Packets are fill plus outline. In-room copy is Portuguese. **Core requirements** (version and a grid of demanded shapes with `received / required` counts) live in a room **sidebar**; **Participantes** lists members and collaborators (letter avatars + nicknames from `frame.collaborators`), and per-room **chat** (signed-in send via `POST /api/towers/:id/chat`, history over SSE `chat`; guests read-only with login redirect). Chat limits come from root TOML (`chat_message_max_length`, `chat_history_limit`, `chat_cooldown_ms`). Per-shape totals come from the server frame (`deliveryByShape`, `demands`); required targets come from `[pipeline]` (e.g. `core_demand_circle` in v0.1). (`CoreRequirementsSidebar`); on narrow viewports the panel sits under the canvas. Git blame on belts is a canvas hover label on desktop and a ~450ms long-press on touch. Product name **Open Pipeline** stays untranslated in UI and metadata titles.

## Version unlock (v0.1 → economy shift)

On **0.1**, when every active demand shape reaches its `required` count, the server auto-advances to **0.2** on the next tick. Unique collaborators no longer gate version unlock (presence and blame still use the collaborator list). Administrators can `POST /api/towers/:id/advance`. All **12** core inputs stay open in v0.1.

Growth uses the **per-player wallet** (passive regen; criteria-based earn later) for belts, machines, and chunk expansion. Version unlock stays **deliveries only**. Chunk keys and `source_spawn_chance_*_percent` live in `[pipeline]`; buy API and probabilistic outer-source spawn are not fully shipped yet. Preview/buy is **edge-adjacent only**. The central starter always places **fire** and **water** (still emit **circle**); other chunks may be empty. Clearance pads apply at generation. See [Coins and map expansion](economy-expansion.md) and [Decisions §11](../decisions.md#11-coins-and-chunk-expansion).

Footprints and machine art rules are locked in [Decisions §9](../decisions.md#9-open-pipeline-machines).

## Stack constraints (do not invent alternatives)

- Static lobby at `/jogo/`; room at `/jogo/torre/?id=<uuid>`.
- Separate Node `game-server`, SQLite, server-authoritative state over **SSE**.
- The grid tick does **not** use Matter.js.
- Do not rename `/jogo/torre/` or `/api/towers`. Do not add a Rust service, WebSockets, or an in-memory-only store.

## Unset design

Ask before inventing rules that are not in the proposal, WIP handoff, locked [Decisions §9](../decisions.md#9-open-pipeline-machines), `AGENTS.md`, or TOML. For machine art, palette, outlines, belt presentation, or resource glyphs, open §9 first — do not invent from memory.

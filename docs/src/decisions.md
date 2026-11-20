# Locked decisions

Records what the team chose (2026-10-14; scope updated 2026-11-15–16). Where a phrase was ambiguous, the reading below applies.

## 1. Two independent areas

GNUverse has **Open Pipeline** and an **authorial blog**. Posts are not rooms; playing does not require publishing; publishing does not change the game.

## 2. Static site + dynamic backends

- Public site: Next.js App Router with `output: "export"`, Cloudflare Pages.
- Blog / identity / media: Payload in `cms/`, planned on Render Free.
- Game: `game-server/` (`node:http`, `node:sqlite`, grid tick in `pipeline/`, SSE — not Matter.js for the match), hosting that stays **always on** with persistent disk (Render Free is not enough). Routes stay `/jogo/` and `/jogo/sala/?id=` / `/api/rooms`.

## 3. Content outside Git

Articles and covers live in the database/storage. Publishing triggers a deploy hook; the build reads published items only, copies covers to `public/cms-media/`, and writes `.content/articles.json`. Code, schemas, and migrations stay versioned.

## 4. Mandatory editorial flow

Roles `author` / `reviewer` / `admin`. Authors submit via `/blog/`; only reviewer/admin publish in `/admin`. Flow: `draft` → `in_review` → `changes_requested` or `approved` → `_status: published`.

## 5. Single account

Canonical registration and session live in Payload. The game does not store passwords; `CMSIdentityProvider` validates each login. Shared roles (`admin`, `blog-editor`, `game-moderator`, …) live in `core/authz/` and in the **People and access** UI (`/acessos` on the CMS host).

## 6. Human authorship

Seven members; 14 initial posts (two each). AI may support code and scaffolding; texts, sources, and logbook reflections stay human.

## 7. Accepted limits

CMS cold start on Render Free; delay until the Cloudflare build finishes; hook without queue/retry; build quotas; public media library on the API; cloud not yet validated in production.

## 8. Language and auth UX

UI copy is Portuguese. Code and docs are English. Sign-in and registration use dedicated pages — no inline auth forms at the call site. See `AGENTS.md`.

## 9. Open Pipeline machines

Locked presentation and footprints for v0.1 (enforced on `Machine` in `game-server/pipeline/machines/`):

| Choice | Rule |
| :--- | :--- |
| Body | Axis-aligned rectangle that **exactly** fills `width × height` cells — **except source:** a **circle** inscribed in the 3×3 AABB (diameter = footprint width in px), fill from the produced element’s catalog `fill` (fallback `color_source`) and `color_outline` / `outline_width_px` stroke |
| Slots | “[”-shaped protuberances from `Machine.slotBracket`; may stick slightly past the body; **one cell** wide along the face. **Drawn under the machine body** so the plate/circle covers the bracket root. **Inputs** use a shallower protrusion (`slot_input_depth_percent`) and a plain bracket. **Outputs** use a deeper one (`slot_output_depth_percent`); output spines include a chevron tip along `slot.travel` (`slot_flow_mark_depth_percent`), same fill and outline as the bracket. **Source outputs:** `SourceMachine.slotBracket` shifts the bracket **back** into the footprint by `outputBracketInsetPercent` of one cell (**45**) so the port meets the circular body without a gap — slot **cells** unchanged |
| Core | **5×5**; 12 inputs (three central tiles per face; corners solid) |
| Source | **3×3**; single output on the **center cell of the facing edge**, one step outside along `direction` |
| Splitter | **1×1**; one input from behind; three outputs on left / forward / right neighbors; round-robin eject; body `color_splitter`; decor `splitter-decor.svg` (hand-drawn orientation arrows; **rotates with `facing`**). May replace the author’s belt on the same cell (facing inherits from that belt). Available in all rooms |
| Trashcan | **2×2**; one input on the back-face center (opposite `facing`); destroys any packet on intake (no buffer, no score); body `color_trashcan`; decor `trashcan-decor.svg` (Quiver; upright like craft combiners). Available in all rooms |
| Tunnel | Factorio-style **1×1** entrance + exit on the same axis, same facing; gap `0..tunnel_max_gap` empty cells (`0` = orthogonally adjacent portals); underground FIFO (`0` = instant entrance→exit); body `color_tunnel`; decor `tunnel-entrance-decor.svg` / `tunnel-exit-decor.svg` (hand-drawn travel arrows; **rotate with portal `direction`**). **Occupancy (client):** while the entrance queue holds packets, a shimmering subsurface seam runs entrance→exit (packet `fill`), soft squashed “mole” ghosts sit on occupied gap cells, and both portals pulse — knobs `tunnel_ghost_*`, `tunnel_seam_*`, `tunnel_pulse_ms` in `[pipeline]`. Shapes that enter and leave in the same tick (gap `0`, or a short lane that clears before the snapshot) are sent as `transit` and drawn as packet discs traveling entrance→exit on top of the portals for that tick. Placing over conveyors replaces the portal cells and leaves the belts between them on the surface. **Facing** on place: client stroke axis first, then belts on entrance/exit if that axis is illegal for the pair geometry. Removing either portal removes the pair. Available in all rooms |
| Fast belt / fast tunnel | **Esteira rápida** / **túnel rápido** palette entries. Gameplay speed `belt_speed_fast` from `[pipeline]` (default **3** cells or queue steps per match tick). Tick uses Factorio-style **subticks**: for each `phase` in `0..belt_speed_fast−1`, belts with `speed > phase` and tunnels with `portal.speed > phase` run one movement/routing micro-step; splitters eject only on phase **0**. Normal belts/tunnels use `speed = 1`. Mixed normal→fast junctions need no special merge rule. Fast belt **track** stays gray (`color_fast_belt`, same family as `color_belt`); **red** chevrons and parallel **side rails** use `color_fast_belt_chevron`, with longer chevron arms `belt_fast_chevron_arm_percent`, rail inset `belt_fast_side_inset_percent`, and chevron timing `belt_fast_chevron_flow_ms`. Fast tunnel body is the same gray (`color_fast_tunnel`); travel arrows tint to `color_fast_belt_chevron` with longer hand-drawn decor (`tunnel-fast-entrance-decor.svg` / `tunnel-fast-exit-decor.svg`) and matching red side rails. Sidebar glyphs `structure-fast-belt.svg` / `structure-fast-tunnel.svg` |
| Decor SVG | Black ink (`#000000`) on transparent under `public/pipeline/`. **New or replacement machine decor must be generated with QuiverAI** (do not hand-draw substitutes unless the user asks) — **exception:** splitter and tunnel decor (including `tunnel-fast-*-decor.svg`) are simple hand-drawn arrows for orientation hinting. Thick strokes use `[pipeline] decor_stroke_width` (512 viewBox) with thinner companion strokes (6 or 8) for detail. At draw time each machine tints its decor to a **darker tone of that machine’s body color** via `darkenHex(body, decor_darken_percent)` — except core gears (see Colors). **Splitter / tunnel** SVGs are authored facing **north** and the painter rotates them to the machine facing (other machines keep upright decor). **Core** layers `core-frame.svg` (static chamfered frame), `core-gear-outer.svg`, and `core-gear-inner.svg` (counter-rotating while that core is active; periods `core_gear_outer_ms` / `core_gear_inner_ms`; hold `core_gear_active_ms` after last intake — [§12](#12-core-gear-activity)). **Source** draws output bracket **under** the circle, then `source-decor.svg` on the footprint rect (tight circular portal frame). No resource glyph on the body. **Craft combiners** keep rounded-square `decor` paths on each `[[machines]]` row and `color` for the body fill |
| Colors | Body: core **white** (`color_core`); **source** uses the produced element’s catalog `fill` (`role ?? shape`; fallback `color_source` / site accent); **splitter** / **tunnel** use `color_splitter` / `color_tunnel` from `[pipeline]`; **fast tunnel** body uses `color_fast_tunnel` (gray) with decor tinted to `color_fast_belt_chevron` (red) instead of darkened body; **craft combiners** keep fixed `[[machines]].color` from `elements.toml` regardless of recipe. **Decor ink** is dynamic: multiply RGB by `(100 − decor_darken_percent) / 100` (default `decor_darken_percent = 35` in `[pipeline]`). **Core overlay:** frame uses `darkenHex(color_core, decor_darken_percent)`; gears are smaller than the plate (inner smaller than outer); each gets an even lighter outline (darkened fill, not `color_outline`) via circular offset underdraw, then fill — both Quiver silhouettes are recentered to a shared 256² pivot; outer is **solid** tinted `color_accent` (clockwise); inner tinted `darkenHex(color_accent, decor_darken_percent)` (counter-clockwise). `color_decor` remains in the palette for future UI only — it is **not** the machine overlay tint. Extended GNUverse palette keys (`color_surface`, `color_muted`, `color_highlight`, `color_warning`, `color_success`, `color_ink`, etc.) live in `[pipeline]` for future painters. Global near-black outline on bodies and slots: `outline_width_px`, `color_outline` (darkest ink). **Element glyphs** (belt packets, source orbit, combiner craft overlay) share one draw path: tint black-ink catalog SVGs to that element’s `fill`, then a **dual outline** from `[pipeline]`: `resource_glyph_outline_outer` / `_inner` colors, `_outer_width_px` / `_inner_width_px`, and `_spread` (silhouette offset multiplier). Legacy `circle` uses the same dual outline on a filled `color_packet` / element-`fill` disk. Machine body outlines still use `outline_width_px` / `color_outline`. Jogo demand masks tint to `fill` via CSS. **Source resource symbol** is **screen-space** (zoom-independent): identity is the source **role / element id** (`role ?? shape`); size from `glyph_size_px` or `resource_glyph_size_px`. Orbit (`resource_glyph_orbit_px`, `resource_glyph_orbit_ms`) runs while a packet is leaving the output and for **one source period plus 1 second** after the last export (period = 60 000 ÷ `source_rate_per_minute`); idle or blocked with that window elapsed stays **centered**. **Combiner overlay:** screen-space static glyph of the **last primary output** (no orbit); while `craftRemaining` counts down and zoom is at/above `craft_progress_wheel_min_zoom`, a progress wheel around that glyph uses the same screen-space scale, stroke in the output element `fill` with a `color_outline` ring (`craft_progress_wheel_width_px`), with fill interpolated between sim ticks (same sync clock as packet motion). Craft and source rates are pieces per minute in `elements.toml` |
| Belts | Procedural tracks only; no decor SVG. Each cell is a **straight** segment along its own `direction` — **no** adjacency-based corner bends. Normal belts: fill + chevron only (**no** outline). Fast belts: same gray fill, plus red chevrons and two parallel side rails (clipped per cell). Ends are square and stop on the cell edge. Chevrons move in the belt direction and are clipped to that cell. **Packet motion:** interpolate along the reconstructed belt cell path (arc-length through cell centers), including multi-hop fast turns — never a straight diagonal that leaves the track |
| Scene LOD (zoom) | Locked **2026-11-20**. Client-only presentation bands from `[pipeline]`: at/above `lod_detail_min_zoom` — full glyphs, belt chevrons, full machine art; at/above `lod_structure_min_zoom` (below detail) — belt packets as catalog-`fill` disks (no packet glyphs), no chevrons (tracks remain), flat machine fills (no decor/brackets) plus full cores; below structure — disks, no chevrons, **cores only** for bodies. **Source orbit glyphs and combiner craft/output glyphs always draw** at every zoom; the craft **progress wheel** only draws at/above `craft_progress_wheel_min_zoom`. Those machine overlays stay **screen-fixed** at `resource_glyph_size_px` above `resource_glyph_world_min_zoom` (zooming in leaves the glyph small on the growing machine) and shrink with the world below it (continuous at the threshold; glyphs may outgrow the body while zooming out before that switch); belt packet icons always stay world-sized. Placement ghosts stay full detail. Thresholds hot-reload with `pipeline.toml`. |
| Clearance (generation) | Per-side depth = `max(machine_clearance_min, I/O ports on that face)`; full rectangular AABB pad (corners included); free pads of different machines must not overlap; applies only when the match layout is generated — belts may use those cells afterward |
| Port / body overlap (placement) | Locked **2026-11-20**. A building port must not occupy another building’s **body**: **outputs** use their exterior slot cell; **inputs** use the approach cell one step outside (where the bracket opens). Checked both ways. **Different buildings may share an empty port cell** (belt in the gap); that is not a machine link. **Splitters** and **tunnels** may propose ports on other bodies when justified by `proposedIsLogistic` (+ tunnel link slots for the pair under test). Non-logistic placements still cannot put a body on any port occupancy cell. **Connected ports (`portsConnected`):** opposite roles; output occupancy cell equals the other machine’s **input slot**; **`travel` matches** so flow enters along the input face. Side or corner dumps onto an input tile from the wrong direction do not connect. **Splitters** may be **body-adjacent** only with such a plug; otherwise reject (`Sem porta compatível em contato.`). **Tunnels** may sit body-adjacent to other buildings; linked portals still use `linkedTunnelSlots` so a fed entrance or accepted exit may occupy that machine’s port cells. Unlinked body contact alone is allowed. Tick **machine-to-machine intake** (`outputReaches`) is that same plug only: output cell equals the input slot and travel matches (**zero** empty cells). A one-cell gap is not a link, including tunnel entrances and exits; that cell needs a belt. |
| Port brackets (visibility) | **Splitters** and **tunnels:** hide a port bracket only when that port is **connected** (not merely body-adjacent, not a shared gap cell). **Core and combiner:** always draw brackets; painter draws logistics first, then **repaints** those brackets on top so a plugged splitter cannot bury them. **Source output:** always drawn **under** the circular body (inset bracket root covered by the plate) — not in the non-logistic top pass. |
| Core extra | `core_clearance_extra` from `[pipeline]` TOML is added on **every** core side on top of port-based depth |
| Initial layout | **Seeded procedural:** `Match.create` hashes the room id / seed to pick one valid placement among the four cardinal approaches (side facing the core plus offset along that face). Clearance pads are enforced the same way on every candidate |

Gameplay loop detail: [Rules and design](game/rules.md).

## 10. Open Pipeline elements (replaces nested shapes)

Locked design direction (2026-11-18; **planned expansion recorded 2026-11-18**, not implemented). Packets are **elements**, not nested geometric shapes. The previous concentric-shape plan (`Circle` / `Triangle` / `Square` / `Diamond`, solid/hollow modifiers) is retired.

### Locked now

| Choice | Rule |
| :--- | :--- |
| Identity | Each packet has one element `id` from TOML under `game-server/config/` |
| Discoverability | Recipes are visible via the elements preview (`make elements-serve`) and in-room help—not via a place-time recipe picker. Sandbox combiners infer output from buffered inputs (exact input-set match to catalog recipes for that machine kind). Core requirements in the Jogo sidebar are clickable and open a production-line ancestry overlay. No hidden alchemy |
| Glyphs | Simple silhouettes with **thick outlines** (SVG). Client outline mode from `resource_glyph_outline_mode`: `dual`, `single`, or `blur` (halo uses `resource_glyph_outline_blur`); solid colors stay on `resource_glyph_outline_outer` / `_inner`. Machine overlay diameter is `resource_glyph_size_px` with **no footprint clamp**. Generate later (Quiver); until then procedural placeholders may stand in |
| Scope | Ship the element graph **with combiners** (not before). v0.1 may keep the current single circle packet until that slice |
| Metaphor | FOSS analogy stays in the logistics / collaboration format; element flavor does not need a strict software metaphor |
| Authoring | Recipe book stays TOML-driven; preview via `make elements-serve` |

### Planned / in progress

Full detail: [Element recipes](game/elements.md#planned-graph-machines-and-core-demands). Summary:

| Choice | Rule | Status |
| :--- | :--- | :--- |
| Catalog size | **36** distinct resources (up to **3** color families) | TOML authored |
| Max tier | **5** | TOML authored |
| Tiers 2–3 | **2-input → 1-output** | TOML authored; **combiner_2** (3×3) placeable in **all** rooms |
| Tier 4 | **3-input → 1 output, or 1 + byproduct** (`outputs` + `coproduct_of`: storm/lightning, kiln/brick, foundry/scrap) | TOML authored; **combiner_3** (5×3) placeable in **all** rooms |
| Tier 5 | **3-input → 1 output**. Capstones consume a tier-4 byproduct (tempest ← lightning; forge ← brick and scrap) | TOML authored |
| 3-in machine I/O | Always **3 in + 2 out ports**. Dual recipe → different packets per port. Single recipe → same packet on both ports; using both **halves** productivity via **port alternation** | Sandbox sim |
| Coupled dual output | Dual recipe ports eject together; one blocked belt stalls both | Sandbox sim |
| Sandbox rooms | `sandbox: true` → element packets + **full-catalog** core demands at once (prototype). Combiners are **not** sandbox-only; normal rooms use chapter-gated demands | Wired |
| Core demands | Full catalog by the **last** chapter; **`retain_prior_demands`**. Per-shape demand escalation for all active shapes (`escalationWaveByShape`, `escalation_ratio = 2`); global `escalationWave` = room clears for **Onda**. **Pontuação** = lifetime delivery score (`materialUnits × score_effort_factor`; dual outputs halve recipe mass) | Wired — [progression](game/progression.md) |
| Three cores | **1** central at create + **2** satellites **discovered** in Chebyshev ring **3–4** when their chunks enter preview; agnostic ports; room-global quotas | Wired — [progression](game/progression.md) |
| Catalog loader | One shared loader (`game-server/pipeline/elements/load-catalog.mjs`) for game-server and `make elements-serve`. Starters, **production rates** (`default_rate_per_minute`, `default_source_rate_per_minute`, per-machine / optional per-recipe or per-base overrides in pieces per minute), fill/stroke/glyph, `[[machines]]` (`color`, `decor`), and chapter base caps live in TOML — not hardcoded in TS. Code converts rates with 60 000 ÷ rate and `tick_ms`. Core body colors stay in `[pipeline]`; source bodies use element `fill`; craft machines use fixed `[[machines]].color`; core art is layered (`core-frame` + gears), source uses `source-decor.svg` | Wired |
| Preview graphs | Design preview keeps orthogonal/highway routing (`[preview]` sizes). In-room overlay (`production-line/`) uses glyph icons + name labels, **direct** arrows, and **repeats** non-adjacent inputs in the previous column so edges stay local; legacy `circle` shows a short fallback | Wired (preview + in-room) |

Recipe book and visualizer: [Element recipes](game/elements.md). Edit TOML under `game-server/config/` (`elements.toml` and optional `elements/**/*.toml`), then `make elements-serve` (http://127.0.0.1:3010). Full progression write-up: [Chapter progression and cores](game/progression.md).

## 11. Coins and chunk expansion

Locked 2026-11-18 (**implementation in progress**). Full write-up: [Coins and map expansion](game/economy-expansion.md). Multi-core ownership: [progression](game/progression.md).

| Choice | Rule |
| :--- | :--- |
| Progression currency | **Coins**, not unique collaborator count |
| Coin pool | **Per-player** account wallet (`WalletService`) |
| Earn | **Passive regen** of `coins_per_minute`, including while away, until `passive_cap`. Refunds may exceed that cap up to `wallet_cap`. Criteria-based earning later |
| Version unlock | **Deliveries only** (no collaborator gate, no coin spend to advance) |
| Spend targets | Conveyors (per cell), machines (per building or tunnel pair), **pooled area expansion**, later paid actions. Same-speed redraws are free. Own deletions refund half, rounded down. Sandbox placement is free |
| Map unit | Square **chunks**; side length `chunk_size` cells in `[pipeline]` |
| Starter | Central index `floor((extent−1)/2)` on both axes |
| Owned at create | **Starter chunk only**. Satellite core chunks are **not** owned until bought after discovery |
| Starter content | Central **5×5** core + sources listed in `elements.toml` `starter_source_ids` (currently fire + water) |
| Neighbor grass | At least one **grass** source in an edge-adjacent preview neighbor of the starter (forced at create; buy to unlock emission) |
| Starter packets | Element ids on the belt in normal rooms |
| World limit | High extent (e.g. **64×64** chunks) from TOML |
| Chunk price | **Linear and pooled:** `chunk_cost_base + chunk_cost_step * (ownedCount - 1)`. Players add chosen amounts. Completing a chunk raises the price of chunks still funded; prior coins stay |
| Preview / buy | Only **edge-adjacent** (orthogonal) neighbors of owned chunks; visible but obscured until bought |
| Generation | **Gradual** from room seed when a chunk first enters the preview set; grass preview neighbor forced at create; satellite cores spawn on first preview of their reserved chunk |
| Non-starter sources | **Optional** rolls via `source_spawn_chance_percent` for every tier-1 base (including starters), except the grass guarantee above |
| Clearance | **On** at generation (`machine_clearance_min`, `core_clearance_extra`); belts may use pad cells afterward |

### Still open (narrow)

| Choice | Why it matters |
| :--- | :--- |
| Criteria-based earn rules | Deferred; do not invent bonuses yet |

## 12. Core gear activity

Locked 2026-11-20. Core decor gears rotate only while that core is receiving packets (and for `core_gear_active_ms` after the last intake). Idle gears hold their last angle. Periods stay `core_gear_outer_ms` / `core_gear_inner_ms`. Detail: [Chapter progression and cores](game/progression.md#core-gear-presentation).

## Still open

| Item | When it resolves |
| :--- | :--- |
| Supabase / Render / Cloudflare accounts and a real publish cycle | Before opening the site to the public |
| CAPTCHA / stronger anti-spam for broad registration | Before advertising external signup (SMTP + rate limit already shipped) |
| `game-server` hosting with a volume | Before `/jogo/` in production |
| 14 posts + logbook + accessibility | By delivery (2026-12-02) |
| Aligned human editorial criteria | Before batch publishing |
| Criteria-based coin bonuses (§11) | Before adding income other than passive regen and refunds |

Operational detail: [Roadmap](engineering/roadmap.md).

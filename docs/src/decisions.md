# Locked decisions

Records what the team chose (2026-10-14; scope updated 2026-11-15–16). Where a phrase was ambiguous, the reading below applies.

## 1. Two independent areas

GNUverse has **Open Pipeline** and an **authorial blog**. Posts are not rooms; playing does not require publishing; publishing does not change the game.

## 2. Static site + dynamic backends

- Public site: Next.js App Router with `output: "export"`, Cloudflare Pages.
- Blog / identity / media: Payload in `cms/`, planned on Render Free.
- Game: `game-server/` (`node:http`, `node:sqlite`, grid tick in `pipeline/`, SSE — not Matter.js for the match), hosting that stays **always on** with persistent disk (Render Free is not enough). Routes stay `/jogo/` and `/jogo/torre/?id=` / `/api/towers`.

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
| Decor SVG | Black ink (`#000000`) on transparent under `public/pipeline/`. **New or replacement machine decor must be generated with QuiverAI** (do not hand-draw substitutes unless the user asks). Thick strokes use `[pipeline] decor_stroke_width` (512 viewBox) with thinner companion strokes (6 or 8) for detail. At draw time each machine tints its decor to a **darker tone of that machine’s body color** via `darkenHex(body, decor_darken_percent)` — except core gears (see Colors). **Core** layers `core-frame.svg` (static chamfered frame), `core-gear-outer.svg`, and `core-gear-inner.svg` (counter-rotating; periods `core_gear_outer_ms` / `core_gear_inner_ms` in `[pipeline]`). **Source** draws output bracket **under** the circle, then `source-decor.svg` on the footprint rect (tight circular portal frame). No resource glyph on the body. **Craft combiners** keep rounded-square `decor` paths on each `[[machines]]` row and `color` for the body fill |
| Colors | Body: core **white** (`color_core`); **source** uses the produced element’s catalog `fill` (`role ?? shape`; fallback `color_source` / site accent); **craft combiners** keep fixed `[[machines]].color` from `elements.toml` regardless of recipe. **Decor ink** is dynamic: multiply RGB by `(100 − decor_darken_percent) / 100` (default `decor_darken_percent = 35` in `[pipeline]`). **Core overlay:** frame uses `darkenHex(color_core, decor_darken_percent)`; gears are smaller than the plate (inner smaller than outer); each gets an even lighter outline (darkened fill, not `color_outline`) via circular offset underdraw, then fill — both Quiver silhouettes are recentered to a shared 256² pivot; outer is **solid** tinted `color_accent` (clockwise); inner tinted `darkenHex(color_accent, decor_darken_percent)` (counter-clockwise). `color_decor` remains in the palette for future UI only — it is **not** the machine overlay tint. Extended GNUverse palette keys (`color_surface`, `color_muted`, `color_highlight`, `color_warning`, `color_success`, `color_ink`, etc.) live in `[pipeline]` for future painters. Global near-black outline on bodies and slots: `outline_width_px`, `color_outline` (darkest ink). **Element glyphs** (belt packets, source orbit, combiner craft overlay) share one draw path: tint black-ink catalog SVGs to that element’s `fill`, then a **dual outline** from `[pipeline]`: `resource_glyph_outline_outer` / `_inner` colors, `_outer_width_px` / `_inner_width_px`, and `_spread` (silhouette offset multiplier). Legacy `circle` uses the same dual outline on a filled `color_packet` / element-`fill` disk. Machine body outlines still use `outline_width_px` / `color_outline`. Jogo demand masks tint to `fill` via CSS. **Source resource symbol** is **screen-space** (zoom-independent): identity is the source **role / element id** (`role ?? shape`); size from `glyph_size_px` or `resource_glyph_size_px`. Orbit (`resource_glyph_orbit_px`, `resource_glyph_orbit_ms`) runs while a packet is leaving the output and for **one source period plus 1 second** after the last export (period = 60 000 ÷ `source_rate_per_minute`); idle or blocked with that window elapsed stays **centered**. **Combiner overlay:** screen-space static glyph of the **last primary output** (no orbit); while `craftRemaining` counts down, a progress wheel around that glyph uses the same screen-space scale and a white-outer / black-inner stroke. Craft and source rates are pieces per minute in `elements.toml` |
| Belts | Procedural tracks only; no decor SVG; **no** outline or under-stroke — belt color and chevron only. Ends are square and stop on the cell edge. Chevrons move in the belt direction and are clipped to that cell |
| Clearance (generation) | Per-side depth = `max(machine_clearance_min, I/O ports on that face)`; full rectangular AABB pad (corners included); free pads of different machines must not overlap; applies only when the match layout is generated — belts may use those cells afterward |
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
| Glyphs | Simple silhouettes with **thick outlines** (SVG). Generate later (Quiver); until then procedural placeholders may stand in |
| Scope | Ship the element graph **with combiners** (not before). v0.1 may keep the current single circle packet until that slice |
| Metaphor | FOSS analogy stays in the logistics / collaboration format; element flavor does not need a strict software metaphor |
| Authoring | Recipe book stays TOML-driven; preview via `make elements-serve` |

### Planned / in progress

Full detail: [Element recipes](game/elements.md#planned-graph-machines-and-core-demands). Summary:

| Choice | Rule | Status |
| :--- | :--- | :--- |
| Catalog size | **36** distinct resources (up to **3** color families) | TOML authored |
| Max tier | **5** | TOML authored |
| Tiers 2–3 | **2-input → 1-output** | TOML authored; **combiner_2** (3×3) in sandbox rooms |
| Tier 4 | **3-input → 1 output, or 1 + byproduct** (`outputs` + `coproduct_of`: storm/lightning, kiln/brick, foundry/scrap) | TOML authored; **combiner_3** (5×3) in sandbox rooms |
| Tier 5 | **3-input → 1 output**. Capstones consume a tier-4 byproduct (tempest ← lightning; forge ← brick and scrap) | TOML authored |
| 3-in machine I/O | Always **3 in + 2 out ports**. Dual recipe → different packets per port. Single recipe → same packet on both ports; using both **halves** productivity via **port alternation** | Sandbox sim |
| Coupled dual output | Dual recipe ports eject together; one blocked belt stalls both | Sandbox sim |
| Sandbox rooms | Combiner placement + element packets + full-catalog core demands only when `sandbox: true` (prototype, non-production) | Wired |
| Core demands | Full catalog required by the **last** chapter, not at match start. `demand_chapter` + `[[chapters]]` (`max_new_bases`, `required_multiplier`) in TOML; inputs cannot be demanded later than the craft | Schedule authored; sim TBD |
| Catalog loader | One shared loader (`game-server/pipeline/elements/load-catalog.mjs`) for game-server and `make elements-serve`. Starters, **production rates** (`default_rate_per_minute`, `default_source_rate_per_minute`, per-machine / optional per-recipe or per-base overrides in pieces per minute), fill/stroke/glyph, `[[machines]]` (`color`, `decor`), and chapter base caps live in TOML — not hardcoded in TS. Code converts rates with 60 000 ÷ rate and `tick_ms`. Core body colors stay in `[pipeline]`; source bodies use element `fill`; craft machines use fixed `[[machines]].color`; core art is layered (`core-frame` + gears), source uses `source-decor.svg` | Wired |
| Preview graphs | Design preview keeps orthogonal/highway routing (`[preview]` sizes). In-room overlay (`production-line/`) uses glyph icons + name labels, **direct** arrows, and **repeats** non-adjacent inputs in the previous column so edges stay local; legacy `circle` shows a short fallback | Wired (preview + in-room) |

Recipe book and visualizer: [Element recipes](game/elements.md). Edit TOML under `game-server/config/` (`elements.toml` and optional `elements/**/*.toml`), then `make elements-serve` (http://127.0.0.1:3010).

## 11. Coins and chunk expansion

Locked 2026-11-18 (**implementation in progress**). Full write-up: [Coins and map expansion](game/economy-expansion.md).

| Choice | Rule |
| :--- | :--- |
| Progression currency | **Coins**, not unique collaborator count |
| Coin pool | **Per-player** account wallet (`WalletService`) |
| Earn | **Passive regen** now; criteria-based earning later |
| Version unlock | **Deliveries only** (no collaborator gate, no coin spend to advance) |
| Spend targets | Conveyors, machines, **area expansion**, later paid actions |
| Map unit | Square **chunks**; side length `chunk_size` cells in `[pipeline]` |
| Starter | Exactly **one** owned chunk; always the **central** index `floor((extent−1)/2)` |
| Starter content | Central **5×5** core + sources listed in `elements.toml` `starter_source_ids` (currently fire + water) |
| Starter packets (interim) | Starter sources still emit **`circle`** until the element packet slice ships; layout `role` is the catalog element id |
| World limit | High extent (e.g. **64×64** chunks) from TOML |
| Chunk price | **Linear:** `chunk_cost_base + chunk_cost_step * (ownedCount - 1)` |
| Preview / buy | Only **edge-adjacent** (orthogonal) neighbors of owned chunks; visible but obscured until bought |
| Generation | **Gradual** from room seed when a chunk first enters the preview set |
| Non-starter sources | **Optional** — per-base `source_spawn_chance_percent` on tier-1 rows in `elements.toml`; never mandatory; only on cells outside clearance free-rects (roll not wired yet) |
| Clearance | **On** at generation (`machine_clearance_min`, `core_clearance_extra`); belts may use pad cells afterward |

### Still open (narrow)

| Choice | Why it matters |
| :--- | :--- |
| Belt / chunk unit prices | Exact TOML costs for place and expand beyond `chunk_cost_*` |
| Criteria-based earn rules | Deferred; do not invent bonuses yet |

## Still open

| Item | When it resolves |
| :--- | :--- |
| Supabase / Render / Cloudflare accounts and a real publish cycle | Before opening the site to the public |
| CAPTCHA / stronger anti-spam for broad registration | Before advertising external signup (SMTP + rate limit already shipped) |
| `game-server` hosting with a volume | Before `/jogo/` in production |
| 14 posts + logbook + accessibility | By delivery (2026-12-02) |
| Aligned human editorial criteria | Before batch publishing |
| Place/expand coin prices (§11) | Before shipping economy/expansion gameplay |

Operational detail: [Roadmap](engineering/roadmap.md).

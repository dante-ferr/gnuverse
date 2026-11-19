# Element recipes

Open Pipeline packets are **elements** defined in TOML under `game-server/config/`. Nested geometric shapes are retired; see [Locked decisions](../decisions.md) §10.

## Authoring (current tooling)

- Primary book: `game-server/config/elements.toml` (**36** ids, max tier **5**)
- Optional extras: any `*.toml` under `game-server/config/elements/`
- Shared loader: `game-server/pipeline/elements/load-catalog.mjs` (also used by the game-server `rules.elements` payload)
- Globals in TOML: `max_tier`, `retain_prior_demands`, `default_rate_per_minute`, `default_source_rate_per_minute`, `default_productivity`, `default_glyph_size_px`, `default_stroke`, `default_demand_required`, `starter_source_ids`
- `[[machines]]` (`color`, `decor` under `public/pipeline/` like element glyphs; `default_rate_per_minute`; core/source body colors stay in `[pipeline]`), `[[chapters]]` (`max_new_bases`, `required_multiplier`), `[preview]` layout sizes
- Per element: `fill` / `stroke` / `glyph` / `family` / `sort_key`; bases add optional `source_rate_per_minute` and `source_spawn_chance_percent` (omit to inherit `default_source_rate_per_minute`); crafts add `machine`, optional `rate_per_minute` (omit to use the machine default), `productivity`
- Sim converts authored rates with period ms = 60 000 ÷ rate and ticks = max(1, round(period ms ÷ `tick_ms` from `[pipeline]`)). `productivity` stays a separate multiplier — not folded into rate
- Interim v0.1 **circle** delivery quota uses `default_demand_required`, not a `[pipeline]` key
- Crafted rows: `inputs` length **2 or 3**; `outputs` defaults to `[id]`, or two ids for dual products
- Co-products: `coproduct_of = "primary_id"` (no `inputs`); must appear in the primary `outputs`
- Tier rule: `tier = 1 + max(tier(inputs))`
- `demand_chapter` assigns when the core starts requiring that element. Inputs must come from the same chapter or an earlier one. New bases per chapter are capped by that chapter’s `max_new_bases`
- Preview rebuilds from TOML on every request

```bash
make elements-serve
```

Open [http://127.0.0.1:3010](http://127.0.0.1:3010). Each recipe card shows an ancestry path chart (orthogonal edges in column gaps, long spans on top highways) plus a direct combination chart. Optional static snapshot: `npm run elements:build` → `game-server/config/elements-graph.html` (gitignored).

Portuguese labels (`name_pt`) appear in the in-game UI (combiner picker, requirement overlay titles). This preview page remains a design tool.

## Planned graph, machines, and core demands

Status: **TOML catalog + preview layout updated** (2026-11-18). **Sandbox-first** in-game slice (2026-11-19): combiners, typed packets, and full-catalog core demands run only in **Sala teste (elementos)** (`sandbox: true`, prototype + non-production). Normal rooms still use circle packets, fire+water starters, and one core.

### Catalog target

| Target | Value | Status |
| :--- | :--- | :--- |
| Distinct resources | **36** | Authored in `elements.toml` |
| Parallel colors | Up to **3** color families | Approx. cool / warm / green-earth in draft colors |
| Max tier | **5** | Authored |
| Core quota | Across match progression, **every** element appears in core demand at least once | Chapter schedule authored in TOML; sim not wired yet |

The core does **not** demand the whole low-tier book at match start. Chapter schedule and `max_new_bases` live in TOML (`retain_prior_demands` keeps older demands active). The current book opens with water, fire, and steam, then adds branches gradually. Pollen and garden wait until chapter 8, with the two capstones that consume tier-4 byproducts. The recipe page lists each chapter under **Quando o núcleo pede cada elemento**.

### Crafting by tier (planned)

| Tier | Typical craft | Notes |
| :--- | :--- | :--- |
| 1 | Sources only | Bases; no combiner inputs |
| 2–3 | **2 inputs → 1 output** | Default combiner; keep recipes obvious |
| 4 | **3 inputs → 1 output, or 1 output + 1 byproduct** | Byproducts are born on the spare port |
| 5 | **3 inputs → 1 output** | Capstone. Consumes at least one tier-4 byproduct |

Tier of a crafted packet is `tier = 1 + max(tier(inputs))`. A co-product shares the primary's tier. No recipe cycles. No alternate recipes for the same output until explicitly allowed later.

Byproducts are the second output of a tier-4 craft (`outputs` plus `coproduct_of`). Each one is an input of a tier-5 capstone.

| Tier-4 craft | Byproduct | Tier-5 consumer |
| :--- | :--- | :--- |
| Storm (`cloud + ash + ember`) | Lightning | Tempest (`storm + lightning + cloud`) |
| Kiln (`clay + charcoal + fire`) | Brick | Forge (`brick + scrap + lava`) |
| Foundry (`alloy + slag + charcoal`) | Scrap | Forge, same capstone |

Clay is the body of the brick. The kiln fires clay, charcoal, and fire, and brick leaves on the second port. The forge is the tier-5 piece that needs that brick, plus scrap from the foundry and lava. Tempest is the other capstone: it takes the lightning the storm threw off. A blocked byproduct belt stalls the tier-4 craft. A missing byproduct blocks the capstone.

### Three-input machine (planned)

- Footprint and art TBD with [Decisions §9](../decisions.md#9-open-pipeline-machines).
- Always exposes **three input slots** and **two output slots**.
- Recipes consumed by this machine always list **three distinct inputs**.

**Outputs**

1. **Two-output recipe** (`outputs = [A, B]` with `A ≠ B`):
   - Port 1 emits `A`, port 2 emits `B`.
   - **Coupled ejection:** a packet leaves one port only if a packet also leaves the other on that craft. If either outgoing belt is blocked, **neither** port ejects.
2. **Single-output recipe** (`outputs = [A]` only):
   - Both ports are capable of emitting `A`.
   - If the player uses **only one** output port, full craft rate goes to that belt.
   - If the player uses **both** output ports, the same material is split: each port gets **half** the productivity (integer/tick rounding TBD when implementing).

The machine shape stays stable (always 3 in / 2 out). A tier-4 recipe may fill the second port with a byproduct. A tier-4 or tier-5 single product may still split one material across both ports.

### Preview / ancestry charts

Preview HTML: `scripts/elements/render.mjs`. In-room overlay: `src/components/game/pipeline/production-line/` (same layout rules, catalog from `rules.elements`).

- Layered columns by tier; barycenter + reverse sweep for row order
- Orthogonal edges bent only inside the **gap** between columns
- Non-adjacent spans use a **top highway** lane (never through node boxes)
- Merge “+” at the gap in front of the crafted node
- Dual outputs share one ancestry chart; co-product sits in the same tier column
- Click a **Requisitos do núcleo** cell to open the overlay (glyph icons, name labels, direct arrows; inputs from earlier tiers are repeated in the previous column); non-catalog shapes (v0.1 `circle`) get a text fallback

### Sandbox slice (implemented)

| Piece | Rule |
| :--- | :--- |
| Footprints | `combiner_2` **3×3**, `combiner_3` **5×3** (width×height) |
| Dual-out | Coupled eject — both ports succeed or neither |
| Half-rate split | Single-output recipe with **both** output belts: alternate ports each craft; one belt → full rate to that port |
| Packets | Element `id` on the belt in sandbox; circle only in normal rooms |

### Implementation order (remaining)

1. Promote combiners + typed packets from sandbox to normal match progression (chapter gates)
2. Wire cumulative core demands so the full catalog is required by late progression outside sandbox
3. Promote tinted catalog glyphs (and `fill` disk fallback) from sandbox to normal match progression as chapter gates land

Locked footprints and half-rate behavior above; split rounding remainder is not needed when alternating ports.
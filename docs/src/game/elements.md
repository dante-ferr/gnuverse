# Element recipes

Open Pipeline packets are **elements** defined in TOML under `game-server/config/`. Nested geometric shapes are retired; see [Locked decisions](../decisions.md) §10.

## Authoring (current tooling)

- Primary book: `game-server/config/elements.toml` (**36** ids, max tier **5**)
- Optional extras: any `*.toml` under `game-server/config/elements/`
- Shared loader: `game-server/pipeline/elements/load-catalog.mjs` (also used by the game-server `rules.elements` payload)
- Globals in TOML: `max_tier`, `retain_prior_demands`, `default_craft_ticks`, `default_productivity`, `default_glyph_size_px`, `default_stroke`, `default_demand_required`, `starter_source_ids`
- `[[machines]]` (`color`, `decor` under `public/pipeline/` like element glyphs; core/source colors stay in `[pipeline]`), `[[chapters]]` (`max_new_bases`, `required_multiplier`), `[preview]` layout sizes
- Per element: `fill` / `stroke` / `glyph` / `family` / `sort_key`; bases add `source_period_ticks` and `source_spawn_chance_percent`; crafts add `machine`, `craft_ticks`, `productivity`
- Crafted rows: `inputs` length **2 or 3**; `outputs` defaults to `[id]`, or two ids for dual products
- Co-products: `coproduct_of = "primary_id"` (no `inputs`); must appear in the primary `outputs`
- Tier rule: `tier = 1 + max(tier(inputs))`
- `demand_chapter` assigns when the core starts requiring that element. Inputs must come from the same chapter or an earlier one. New bases per chapter are capped by that chapter’s `max_new_bases`
- Preview rebuilds from TOML on every request

```bash
make elements-serve
```

Open [http://127.0.0.1:3010](http://127.0.0.1:3010). Each recipe card shows an ancestry path chart (orthogonal edges in column gaps, long spans on top highways) plus a direct combination chart. Optional static snapshot: `npm run elements:build` → `game-server/config/elements-graph.html` (gitignored).

Portuguese labels (`name_pt`) are for the in-game UI later; this preview page is a design tool.

## Planned graph, machines, and core demands

Status: **TOML catalog + preview layout updated** (2026-11-18). **Sandbox-first** in-game slice (2026-11-19): combiners, typed packets, and full-catalog core demands run only in **Sala teste (elementos)** (`sandbox: true`, prototype + non-production). Normal rooms still use circle packets, fire+water starters, and one core.

### Catalog target

| Target | Value | Status |
| :--- | :--- | :--- |
| Distinct resources | **36** | Authored in `elements.toml` |
| Parallel colors | Up to **3** color families | Approx. cool / warm / green-earth in draft colors |
| Max tier | **5** | Authored |
| Core quota | Across match progression, **every** element appears in core demand at least once | Chapter schedule authored in TOML; sim not wired yet |

The core does **not** demand the whole low-tier book at match start. Chapter schedule and `max_new_bases` live in TOML (`retain_prior_demands` keeps older demands active). The current book opens with water, fire, and steam, then adds branches gradually; pollen and garden wait until chapter 8. The recipe page lists each chapter under **Quando o núcleo pede cada elemento**.

### Crafting by tier (planned)

| Tier | Typical craft | Notes |
| :--- | :--- | :--- |
| 1 | Sources only | Bases; no combiner inputs |
| 2–3 | **2 inputs → 1 output** | Default combiner; keep recipes obvious |
| 4 | **3 inputs → 1 output** (machine has 2 out ports) | See dual-port rules below |
| 5 | **3 inputs → 1 or 2 outputs** | Capstone tier; slow to unlock |

Tier of a crafted packet still follows ancestry depth (exact formula may be restated when the 36-id graph is authored). No recipe cycles. No alternate recipes for the same output until explicitly allowed later.

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

This keeps the machine shape stable (always 3 in / 2 out) while letting tier-4 single products and tier-5 dual products share hardware.

### Preview / ancestry charts

Implemented in `scripts/elements/render.mjs`:

- Layered columns by tier; barycenter + reverse sweep for row order
- Orthogonal edges bent only inside the **gap** between columns
- Non-adjacent spans use a **top highway** lane (never through node boxes)
- Merge “+” at the gap in front of the crafted node
- Dual outputs share one ancestry chart; co-product sits in the same tier column

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
3. Finish glyph rendering on belts for every element (sandbox client falls back to `fill` disk when SVG not loaded)

Locked footprints and half-rate behavior above; split rounding remainder is not needed when alternating ports.
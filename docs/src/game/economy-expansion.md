# Coins and map expansion

Direction for Open Pipeline after v0.1 review (2026-11-18). Replaces **player-count** gating for progression. Numbers live in `[pipeline]` in `game-server/config/game.config.toml` — do not hardcode them in TypeScript.

## Intent

Players spend **coins** to place conveyors, machines, expand the playable map, and (later) other unlocks. Progression is economic, not social: the room does **not** need more unique collaborators to grow.

There is **no extra leveling gate** beyond what coin spending already unlocks (see [Open questions](#open-questions)). Version labels may still exist for content chapters; they are not gated on collaborator count.

## Coins

| Topic | Direction |
| :--- | :--- |
| Spends | Belts, machines, **chunk expansion**, and later paid actions |
| Earn | **Open** — see questions below (deliveries vs passive regen vs account wallet) |
| Pool | **Open** — shared room balance vs per-player wallets |
| Cap / regen | Revisit root TOML `balance_cap` / `coin_interval_ms` once the pool is chosen; today’s account wallet is for lobby room costs, not match building |

Belts do not spend coins in the current v0.1 build; coin costs for placement are part of this change.

## Chunked map

The world is a grid of **square chunks**. Cell count per chunk side is `chunk_size` in `[pipeline]`. The **starting** owned region is exactly one chunk of that size (not a different starter footprint).

| Key (planned TOML) | Role |
| :--- | :--- |
| `chunk_size` | Cells on one side of a purchasable chunk (also the starting owned chunk) |
| `map_chunk_extent` | Max chunks on each axis (e.g. **64** → up to 64×64 chunks) |
| `chunk_cost_base` | Cost of the first purchased expansion chunk |
| `chunk_cost_growth` | Non-linear growth factor (exact curve **open**) |
| `chunk_preview_ring` | How far beyond owned chunks features stay visible but obscured (Chebyshev ring in chunk units) |

`grid_width` / `grid_height` today describe a single fixed playfield. Under this model they become derived from owned chunks (or are replaced by `chunk_size` + owned set). The absolute world limit is `chunk_size * map_chunk_extent` cells per axis.

### Visibility

- **Owned** chunks: fully playable (place belts/machines, simulate packets).
- **Preview (obscured)** chunks: map features in a ring around owned territory are **visible but dimmed / obscured**, so players see what they would unlock. They cannot place or run simulation there until purchased.
- **Unknown** chunks beyond the preview ring: not generated and not shown.

### Purchase

Buying a preview chunk spends coins and marks it owned. Prices rise **non-linearly** with expansion (not `base * n`). Preferred first curve (pending lock): exponential in purchase index, `floor(base * growth^n)` with `n = owned_chunks - 1` after the free starter — or distance-from-start if that better matches the FOSS “frontier” feel (see open questions).

Only chunks inside `map_chunk_extent` are eligible.

### Gradual generation (seed)

The full 64×64 chunk world is **not** materialized when the room starts.

1. Room create: hash the seed; materialize the **starting owned chunk** only (core + initial layout).
2. When the owned set changes, compute the preview ring.
3. The first time a chunk enters the preview set, **generate that chunk once** from the room seed (deterministic). Persist generated content with the match.
4. Buying a chunk only flips ownership; content was already created when it became obscured.

Generation must be idempotent per chunk coordinate: same seed + chunk coords → same machines/sources.

### Sources for procedural tests

While the generator is under test, place **circle sources across generated chunks** (density and clearance from TOML / existing clearance rules). This exercises seed placement without waiting for the full element catalog. Later chapters replace or thin these with real resource sources.

### Starting layout

- One free owned chunk at match start (same `chunk_size` as every other chunk).
- Central **5×5** core stays in that starter chunk (centered in the chunk, same clearance rules as today).
- Chunk coordinates: prefer a **centered** starter inside the extent so expansion can go in all four directions (exact origin index = open if extent is even).

## What this retires

| Old rule | New direction |
| :--- | :--- |
| `unlock_collaborators` required to advance 0.1 → 0.2 | Removed as a progression gate |
| Full fixed `grid_width`×`grid_height` playfield at create | Owned + preview chunks only; grow by purchase |
| Proposal “unique players unlock map space” | Map space unlocks with **coins** |

Collaborator records and the Participantes sidebar remain useful for presence and blame; they no longer unlock versions or map size.

## Open questions

Resolve with the product owner before locking implementation details:

1. **Coin pool:** shared room balance, per-player wallets, or hybrid (personal build costs / shared chunks)?
2. **Earning:** core deliveries, passive match regen, existing account wallet, or a mix?
3. **Version unlock:** coins only, deliveries only, no version gate (buy content with coins), or keep demand quotas without collaborators?
4. **Cost curve:** exponential in purchase count, quadratic, or by distance from the starter chunk?
5. **Buy eligibility:** edge-adjacent to owned only, any preview chunk, or any unowned chunk in extent?
6. **Starter chunk index** when `map_chunk_extent` is even (e.g. 64): which chunk contains the core?

## Implementation notes (from current code)

v0.1 has **no** chunks, fog, or rings in `game-server/pipeline/` or the room scene — only a fixed `grid_width`×`grid_height` sparse match (`belts` / `packets` / one `source` / one `core`).

| Concern | Extension point |
| :--- | :--- |
| Layout | Grow `map-layout.ts` + `clearance.ts`; sub-seed per chunk (`${seed}:chunk:${cx},${cy}`) |
| Frame | Owned + generated/preview chunk sets; migrate single `source` → `sources[]` for multi-source tests |
| Sim | `Match.inBounds` / `BeltEditor` / `Emission` must honor owned cells and every source |
| Client | `GridPainter` + dim overlay for preview chunks; sync `GridCamera` from frame size (today initial fit is hardcoded 24×24) |
| Coins | Account `WalletService` is passive lobby balance today; belt `place` does not spend — match spend is new server logic |
| Unlock | Collaborator gate lives only in `unlock.ts` + Participantes UI (display); remove from auto-unlock path |

## Related

- Gameplay loop: [Rules and design](rules.md)
- Machine footprints / clearance: [Decisions §9](../decisions.md#9-open-pipeline-machines)
- Locked economy/expansion summary: [Decisions §11](../decisions.md#11-coins-and-chunk-expansion)
- Code map: [Game code map](map.md)

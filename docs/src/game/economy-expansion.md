# Coins and map expansion

Locked direction for Open Pipeline (2026-11-18). Replaces **player-count** gating for progression. Numbers live in `[pipeline]` / root tables in `game-server/config/game.config.toml` — do not hardcode them in TypeScript.

## Intent

Players spend **coins** to place conveyors, machines, expand the playable map, and (later) other unlocks. Progression is economic, not social: the room does **not** need more unique collaborators to grow.

Version advance (`0.1 → 0.2` and later) uses **delivery milestones only**. Map growth and building use the **per-player wallet**.

## Coins

| Topic | Rule |
| :--- | :--- |
| Pool | **Per-player** account wallet (existing `WalletService` / root TOML `balance_cap`, `initial_balance`, `coin_interval_ms`) |
| Earn (now) | **Passive regen** toward the cap (current wallet behavior) |
| Earn (later) | Criteria-based bonuses on top of passive regen (not specified yet) |
| Spends | Belts, machines, **chunk expansion**, and later paid actions |

Belts do not spend coins in the current build; coin costs for placement are part of this change.

## Version unlock

Auto-advance when **every active demand** meets its `required` count. No collaborator threshold. No coin spend required to bump the version label. Administrators may still `POST /api/towers/:id/advance`.

## Chunked map

The world is a grid of **square chunks**. Cell count per chunk side is `chunk_size` in `[pipeline]`. The **starting** owned region is exactly one chunk of that size.

| Key | Role |
| :--- | :--- |
| `chunk_size` | Cells on one side of a purchasable chunk (also the starting owned chunk) |
| `map_chunk_extent` | Max chunks on each axis (e.g. **64** → up to 64×64 chunks) |
| `chunk_cost_base` | Cost of the first purchased expansion chunk |
| `chunk_cost_step` | Linear increment per further purchase (`base + step * (ownedCount - 1)`) |

Absolute world limit: `chunk_size * map_chunk_extent` cells per axis. Legacy `grid_width` / `grid_height` remain until the match is fully chunk-backed.

### Visibility and purchase

- **Owned** chunks: fully playable.
- **Preview (obscured)** chunks: only **edge-adjacent** (orthogonal N/E/S/W) neighbors of owned chunks. Features are **visible but dimmed**. Players may buy any preview chunk; they cannot place or simulate there until owned.
- **Unknown** beyond that: not generated and not shown.

Diagonals are **not** previewed and **not** purchasable until they become edge-adjacent after another buy.

### Cost (linear)

With `ownedCount` including the free starter (`ownedCount >= 1`):

`nextCost = chunk_cost_base + chunk_cost_step * (ownedCount - 1)`

Example (`base = 5`, `step = 2`): first buy **5**, second **7**, third **9**, …

### Gradual generation (seed)

The full extent is **not** materialized when the room starts.

1. Room create: materialize the **central starter chunk** only (core + chapter-1 sources).
2. When the owned set changes, recompute edge-adjacent preview coords.
3. The first time a chunk enters the preview set, **generate that chunk once** from the room seed (deterministic sub-seed). Persist with the match.
4. Buying only flips ownership; content was created when it became obscured.

### Starter chunk

- Index: **always central** — `floor((map_chunk_extent - 1) / 2)` on both axes (e.g. extent 64 → chunk `(31, 31)`).
- Contains the **5×5** core (centered in the chunk) and **exactly two** fixed sources: chapter 1 **fire** and **water** (`elements.toml` chapter 1 / `demand_chapter = 1`).
- Clearance rules from [Decisions §9](../decisions.md#9-open-pipeline-machines) still apply at generation time.
- **Interim packets:** both sources still emit **`circle`** (current sim). Layout and authorship treat them as fire and water so the element slice can swap identity later without redoing chunk placement. Core demands stay on the existing circle milestone until elements ship.

### Other generated chunks (source spawn)

Non-starter chunks are **not required** to contain any source. A chunk may be empty of machines.

When real element sources ship, generation rolls **per source type** using static chances in `[pipeline]`:

| Key | Role |
| :--- | :--- |
| `source_spawn_chance_circle_percent` | Interim / test circle emitter (0–100) |
| `source_spawn_chance_fire_percent` | Fire source (0–100); starter placement ignores this |
| `source_spawn_chance_water_percent` | Water source (0–100); starter placement ignores this |

**Algorithm (planned, not wired yet):** for each non-starter chunk the first time it enters the preview set, for each source type with chance `P > 0`, draw once from the chunk sub-seed. On a hit, pick a random footprint origin inside that chunk whose **clearance free-rect** does not overlap any already placed machine free-rect (`machine_clearance_min` / `core_clearance_extra` via `geometry/clearance.ts`). If no valid origin exists, skip — do not force a source.

**Clearance today:** **on** for match layout (starter core + fire/water, and any future procedural placements). Belts may still occupy former pad cells after generation.

## What this retires

| Old rule | New direction |
| :--- | :--- |
| `unlock_collaborators` required to advance | Removed; deliveries only |
| Full fixed playfield at create | Owned + edge-adjacent preview; grow by purchase |
| Proposal “unique players unlock map space” | Map space unlocks with **per-player coins** |
| Exponential chunk pricing (early scaffold) | **Linear** `base + step * n` |

## Implementation notes

| Concern | Extension point |
| :--- | :--- |
| Layout | `map-layout.ts` + `clearance.ts`; sub-seed `${seed}:chunk:${cx},${cy}` |
| Frame | Owned + generated/preview sets; `sources[]` (fire, water, …) |
| Sim | `Match.inBounds` / `BeltEditor` / `Emission` honor owned cells and every source |
| Client | Dim overlay for preview chunks; sync `GridCamera` from frame size |
| Coins | Deduct via existing per-player `WalletService` on place / chunk buy |

## Related

- Gameplay loop: [Rules and design](rules.md)
- Machine footprints / clearance: [Decisions §9](../decisions.md#9-open-pipeline-machines)
- Locked summary: [Decisions §11](../decisions.md#11-coins-and-chunk-expansion)
- Elements / chapters: [Element recipes](elements.md)
- Code map: [Game code map](map.md)

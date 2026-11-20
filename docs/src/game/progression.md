# Chapter progression and cores

Locked 2026-11-20. Replaces the proposal’s **9-core federation** victory path for the element catalog. Numbers live in `pipeline.toml` / `elements.toml` — do not hardcode them in TypeScript.

## Intent

Prior core demands stay active for the whole match (`retain_prior_demands = true`). Chapters add new required elements; leveling up needs **every** active demand at once. Dropping an older supply does not end the match — it blocks chapter advance.

The catalog has **36** elements. One **5×5** core has **12** input ports, so late-game concurrent types need more sinks. Normal matches therefore reserve **two** satellite cores in the outer ring for players to **discover** by expanding the map.

## Cores (3 total)

| Topic | Rule |
| :--- | :--- |
| Count | **1** central + **2** satellites (`satellite_core_count = 2`) |
| Timing | Central core at **match create**. Satellites are seed-reserved and **discovered** when their chunk first enters the preview set (buy to play there) |
| Acceptance | Any open port on **any** discovered core accepts any **currently demanded** type. Quotas are **room-global** (`deliveryByShape`), not per-core |
| Central | Centered in the starter chunk (same as today) |
| Satellites | Seed-picked in a **Chebyshev** ring: distance ∈ [`satellite_core_ring_min`, `satellite_core_ring_max`] (default **3–4**) from the starter chunk. Rings at distance **1–2** are the intentional **2-chunk gap** (no satellite cores there) |
| Ownership at create | Starter chunk only. Grass neighbor is preview (buy to play). Satellite chunks stay void until previewed/bought |
| Generation | Owned chunks plus edge previews materialize at create. Satellite cores spawn when their reserved chunk enters preview |

`[pipeline]` keys:

| Key | Default | Role |
| :--- | ---: | :--- |
| `satellite_core_count` | 2 | Extra cores besides the central one |
| `satellite_core_ring_min` | 3 | Inclusive Chebyshev min from starter |
| `satellite_core_ring_max` | 4 | Inclusive Chebyshev max from starter |

Sandbox rooms may keep a compact multi-core layout for prototype play; production layout follows this ring rule.

## Sources

| Topic | Rule |
| :--- | :--- |
| Starter chunk | Always places `starter_source_ids` (**fire**, **water**) — spawn odds ignored |
| Grass guarantee | At least one **grass** source in an **edge-adjacent** (N/E/S/W) neighbor of the starter. Match create generates that preview chunk with grass; it stays locked until bought (never a satellite-core chunk) |
| Outer bases | Every tier-1 base with `source_spawn_chance_percent` > 0 may roll on non-starter generated chunks, including fire and water (see [Coins and map expansion](economy-expansion.md)) |

## Chapters and unlock

| Topic | Rule |
| :--- | :--- |
| Schedule | `demand_chapter` + `[[chapters]]` in `elements.toml` |
| Active set | Elements with `demand_chapter ≤ current chapter`, and all prior demands if `retain_prior_demands` |
| Advance | When every active demand’s progress ≥ `required` (delivery-only; no collaborator gate): advance chapter while content remains, and always bump **`escalationWave`** |
| Craft escalation | From the **first clear** onward (`escalationWave ≥ 1`), crafted demands use mild geometry: **required = ceil(base × escalation_ratio^wave)** (`escalation_ratio = 1.18`). Each clear uses a **fresh** craft-wave counter (`waveDeliveryByShape`) |
| Tier-1 bases | **Do not escalate.** Fire, water, grass, and other tier-1 sources keep flat `base` quotas and lifetime `deliveryByShape` progress (so prior bases stay met under `retain_prior_demands`) |
| After last chapter | Chapter stays on the final id; waves keep rising. Full catalog stays demanded |
| Score | **Pontuação** = lifetime `deliveries` (for later room ranking). Sidebar shows **Onda** after the first clear |
| Victory | None — no crash / game-over |

## Core gear presentation

Gears on a core rotate only while that core is ingesting (or within a short hold after the last intake). Idle cores stay frozen at the last angle.

| Key | Default | Role |
| :--- | ---: | :--- |
| `core_gear_outer_ms` / `core_gear_inner_ms` | 12000 / 7000 | Full-turn periods while active |
| `core_gear_active_ms` | 3500 | Keep spinning this long after the last packet entered **that** core |

## Related

- Element book / chapter copy: [Element recipes](elements.md)
- Chunk buy and gradual gen: [Coins and map expansion](economy-expansion.md)
- Locked summary: [Decisions](../decisions.md) §10–§12
- Sandbox slice (full catalog at once): [Element recipes — sandbox](elements.md#sandbox-slice-implemented)

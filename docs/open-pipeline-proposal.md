# Context & Operational Directives
- **Codebase Refactor:** Use the existing repository and technical foundation from my current tree-game attempt, replacing the tree game mechanics and assets with this new top-down cooperative logistics game.
- **Keep the Existing Tech Stack:** Inspect the current repository first to identify the backend, frontend, and communication technologies already configured, and continue using that exact stack. Do not introduce unnecessary frameworks or rewrite the underlying infrastructure.
- **Ask Before Major Decisions:** Always ask me for confirmation whenever you need to make a significant architectural, gameplay, or UX decision, or if any requirement feels ambiguous or conflicting.
- **Creative Freedom:** You have creative freedom to propose and incorporate new mechanics, visual polish, or quality-of-life improvements that fit the theme—just check in with me if they alter core rules.
- **Out of Scope:** Do not worry about cloud deployment, Dockerfiles, or hosting configurations; I will handle deployment later.

---

# 1. Core Concept & Hard Victory Limit
Build a real-time cooperative multiplayer top-down grid logistics web game ("Open Pipeline") serving as an interactive analogy to Free and Open-Source Software (FOSS). Players collaborate on a shared grid from mobile and desktop browsers to route, combine, and scale geometric data packets into a growing federation of Cores.
- **Finite End Condition (9 Cores):** Although the system scales progressively through version milestones, it has a defined victory condition: **stabilizing the 9th Core** (1 Central Core + 8 Satellite Cores) and meeting its final delivery target. Upon completion, display a victory screen summarizing contributor stats and allowing players to export/download the final network map before resetting.

---

# 2. Strict Rendering Rule (Procedural vs. SVG)
- **Procedural Code Rendering:** All dynamic, calculated, or composite game visuals—including the grid, rounded conveyor tracks, moving packets, concentric nested shapes, state modifiers, and animations—must be rendered procedurally in code (e.g., HTML5 Canvas 2D or the existing procedural drawing context).
- **SVG Usage:** Use `<svg>` strictly for static UI icons and HUD elements that do not require geometric calculation to generate.

---

# 3. Collaboration Mechanics: Network-Effect Unlocks
Instead of punitive timers or scarce currencies, building is cheap and immediate, while **capabilities and map space** unlock collectively as more unique players join:
- **Accessible Building:** Drawing conveyors and placing unlocked pieces is low-cost and responsive, governed only by a generous active-tile soft cap per player (e.g., ~25 active tiles per player, recycling their oldest tile if exceeded) so players never sit idle waiting.
- **Dual Unlock Gate (Deliveries + Unique Collaborators):**
  - Track unique participants per match via a persistent session token (`localStorage`).
  - Unlocking the next version tier requires reaching **both** the delivery milestone **and** the unique collaborator count threshold.
  - **Irreversible Unlocks ("Open Source Persistence"):** Once a participant joins and increments the room's collaborator count, that progress and all unlocked shapes/machines/map expansions remain permanently unlocked for the match even if they disconnect.
  - **Solo Evaluator Fallback:** If only 1 player is connected (`unique_players == 1`) and the delivery milestone for the current version is met, automatically satisfy the player threshold after **45 seconds** so solo testing never soft-locks.

---

# 4. Federated Cores & Cumulative Demand
- **Central Core (`3x3` Grid Footprint):** Positioned at the center of the map with **12 perimeter faces**. It starts with only **2 open input ports** and unlocks additional ports as version milestones advance, keeping all previous demands active (retrocompatibility).
- **Satellite Cores (`2x2` Grid Footprint, 8 Ports Each):** As the map expands outward past `v1.0`, new Satellite Cores spawn in outer sectors (up to **9 total cores**). Satellite Cores decentralize traffic so distant sources do not have to route all the way to the center.
- **Agnostic Ports & Shared Global Stability:**
  - Any open port on any active Core accepts **any** currently demanded packet type (preventing accidental griefing from misrouted belts).
  - All Cores feed a single **Global Stability Bar**. Each demanded packet type requires a steady delivery rate; if any demanded type is starved, stability drains toward a System Crash (Game Over).
  - Higher-tier composite packets restore significantly more stability per delivery than basic shapes.

---

# 5. Shape System & Grid Entities (Deterministic Tick Loop)
To guarantee crisp legibility on small mobile screens, use only **4 base shapes** (`Circle`, `Triangle`, `Square`, `Diamond`) combined via **concentric nesting** (outer shape + inner core shape) and **binary state modifiers** (`Solid` vs. `Hollow`, plus color polarity):

1. **Sources (Fixed):** Emit base shapes at regular intervals.
2. **Unidirectional Conveyors (Player-Built):** Hold at most 1 packet per cell and push it forward in their facing direction. Render consecutive belts as smooth, continuous rounded tracks with directional chevrons.
3. **Splitters / Forks (Player-Built):** Distribute incoming packets evenly (round-robin) across connected outgoing belts to share load across parallel lines.
4. **Mergers (Player-Built):** Combine up to 3 incoming belts into a single multiplexed output belt so one Core port can ingest multiple item types.
5. **Tunnels (Player-Built):** Allow an underground belt segment to pass cleanly beneath perpendicular surface belts without mixing packets. *(Use Tunnels only—no Bridges).*
6. **Combiners (Fixed on Map):** Accept 2 distinct shapes on marked input ports and output a single concentric nested shape (e.g., `Triangle` inside `Circle`).
7. **State Modifiers (Fixed on Map):** Toggle a packet's fill (`Solid` $\leftrightarrow$ `Hollow`) or color polarity as it passes through.
8. **Bugs — Linus's Law (Active Free Action):** Periodically spawn as pulsing red glitch packets. Reaching a Core temporarily disrupts stability/throughput; any player can double-tap/double-click directly on a moving Bug to squash it for free.
9. **Legacy Slowdown Zones:** Periodic hatched grid sectors that reduce belt speed by 50%, encouraging parallel bypass routes (*forks*).
10. **Visual Git Blame:** Store the anonymous contributor alias on every player-placed tile and display it on hover (desktop) or tap/long-press (mobile).

---

# 6. Semantic Versioning Progression & Map Expansion
Generate the full map layout at match start using **concentric outward rings** (reserving at least 2 empty walkable cells around every Source, Machine, and Core to prevent routing deadlocks) and reveal rings progressively:
- **`v0.1` (MVP):** `Circle` + Unidirectional Conveyors. Central Core (`3x3`, 2 ports active).
- **`v0.2` (Forks):** `Triangle` + **Splitters** & **Mergers**. Map expands; new Central Core ports open.
- **`v0.3` (Modularity):** `Square` + **Combiners** & **Tunnels**. Map expands; composite shape demands begin.
- **`v0.4` (Refinement):** `Diamond` + **State Modifiers** + **Bugs** & **Legacy Slowdown Zones**.
- **`v1.0` (Release):** Full Central Core capacity active + first **Satellite Core** (`2x2`) unlocks in the outer ring.
- **`v1.x+` (Federation to Victory):** Progressive outer expansions spawning Satellite Cores #2 through #8 (totaling **9 Cores**), scaling emission throughput until the 9th Core's milestone is completed.

---

# 7. Mobile-First UX
- **Gestures:** Drag across cells to chain unidirectional conveyors; tap to place/rotate Splitters, Mergers, or Tunnels; double-tap or right-click a player tile to delete/refactor it.
- **Camera & Navigation:** Support two-finger pan and pinch-to-zoom (plus mouse wheel/drag on desktop) as the grid grows, with subtle directional edge indicators alerting players when an off-screen Core or Source needs attention.

---

# First Step
Inspect the existing repository structure and dependencies first, then summarize what you found and ask me any clarifying questions before starting the implementation.
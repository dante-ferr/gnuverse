# Open Pipeline — work in progress handoff

**Status:** WIP v0.1 — playable slice on `feat/game`, not product-complete.  
**Product name:** Open Pipeline (never translate the name in UI or metadata titles).  
**Design north star:** [`open-pipeline-proposal.md`](open-pipeline-proposal.md) — when this handoff and the proposal disagree, ask the user; the repo’s [`AGENTS.md`](../AGENTS.md) wins on stack and URLs.

## How to use and update this document

Another agent should treat this file as the living checklist for staged delivery, not a substitute for reading code.

1. **After every merged stage** (or before handing off), edit this file in the same PR or commit series:
   - Move items from **Next** → **Done** with a one-line note and date.
   - Add new **Gaps / debt** entries when you discover them; remove only when fixed.
   - Bump **Current version** only when the user reviews and approves that slice (v0.1 → v0.2).
2. **Do not** rewrite the full proposal here; link to it and record **repo-specific decisions** only.
3. **Do not** mark a stage complete without: targeted tests green (`tests/pipeline-*.test.ts` at minimum), manual smoke on `/jogo/sala/?id=`, and config numbers still in TOML not TS.
4. If you change HTTP actions, frame shape, or machine geometry, update the **Architecture map** section below in the same change.

---

## Current version: v0.1 (under review)

### Intent

One room, one **3×3** circle source, player-built belts, a **5×5 central core** with **12 input slots** (three central tiles per face, corners solid). Server tick moves packets simultaneously; deliveries accumulate with **no stability bar and no crash**. CMS login required to place or remove belts. Core requirements in a room sidebar (stacked under the canvas on mobile); git blame on belts stays on the canvas.

**Progression pressure (proposal, not v0.1 code yet):** when more packet types are demanded, prior supplies stay required. Dropping an older line does not end the match — it blocks leveling up because the delivery milestone needs every demanded type.

### Repo decisions that differ from the proposal doc

| Topic | Proposal (staged vision) | This repo (v0.1 WIP) |
| --- | --- | --- |
| Core footprint | Starts `3×3`, grows with versions | Fixed **5×5** now; see `CoreMachine` |
| Source footprint | Unspecified / 1 cell implied | Fixed **3×3** with one face-center output; see `SourceMachine` |
| Active core ports | Milestone-gated (e.g. 2 ports at start) | **All 12** inputs accept deliveries in v0.1 |
| Machine art | Proposal: procedural for geometric visuals | Cell-fit body + “[” slots procedural; QuiverAI black-ink decor tinted darker than each body (`decor_darken_percent`) — [Decisions §9](../decisions.md#9-open-pipeline-machines) |
| Collaborators | `localStorage` token option | **CMS accounts only**; `join` records nickname |
| Building cost | Cheap, no coin gate | Per-structure prices in `[pipeline]`; half refund on your own delete — [economy-expansion.md](economy-expansion.md) |
| Map / progression | Unique players unlock space | Pooled chunk funding; gradual seed gen; no collaborator unlock gate — [Decisions §11](../decisions.md#11-coins-and-chunk-expansion) |
| Fail / victory | No crash; victory at 9 cores | **No fail state**; **3 cores** + cumulative catalog (9-core path retired) — [progression.md](progression.md); no victory screen yet |

### Done (implemented)

- **Pontuação:** recursive material-based delivery score (`score_effort_factor` in `elements.toml`; dual outputs halve recipe mass) — 2026-11-20.
- **Server sim:** `game-server/pipeline/` — `Machine` / `SourceMachine` / `CoreMachine` / `BeltMachine` / `SplitterMachine` / `TunnelPortalMachine`, `Match`, `Movement`, `Routing`, `Emission`, `BeltEditor` / `MachineEditor` (no `StabilityMeter`).
- **Splitter + tunnels:** 1×1 RR divisor and Factorio-style portal pairs (`tunnel_max_gap`); placeable in all rooms — 2026-11-19.
- **Fast belt / fast tunnel:** `belt_speed_fast` subtick movement; palette **Esteira rápida** / **Túnel rápido** — 2026-11-20.
- **Config:** [`pipeline.toml`](../game-server/config/pipeline.toml) (gameplay) + [`game.config.toml`](../game-server/config/game.config.toml) (server/lobby), loaded via [`pipeline/load-rules.ts`](../game-server/pipeline/load-rules.ts).
- **HTTP:** `POST /api/rooms/:id/place`, `remove`, `join`, `chat`; SSE `frame` pushes `PipelineFrame`; SSE `chat` pushes room messages.
- **Client:** `src/components/game/pipeline/` — canvas scene, painters, drag belts, pan/zoom; room at `/jogo/sala/` via `PipelineRoom` with sidebar chat + collaborators.

- **Art:** dark grid / light machines; procedural bodies/slots + `color_outline`; decor SVGs tint to a darker tone of each body color (`decor_darken_percent`); `color_decor` is palette-only for future UI; screen-space circle resource = one filled disk (canvas outline); sidebar uses `resource-circle.svg` (single black fill); `decor_stroke_width` on thick decor strokes.
- **Tests:** [`tests/pipeline-tick.test.ts`](../tests/pipeline-tick.test.ts), [`tests/pipeline-http.test.ts`](../tests/pipeline-http.test.ts), [`tests/pipeline-unlock-http.test.ts`](../tests/pipeline-unlock-http.test.ts).
- **Unlock:** `game-server/pipeline/world/progression/unlock.ts` — demand milestones only (collaborator gate removed 2026-11-18); auto **0.1 → 0.2**; `POST /api/rooms/:id/advance` (admin).
- **Chunk scaffolding:** `[pipeline]` `chunk_size` / `map_chunk_extent` / `chunk_cost_base` + `chunk_cost_step` (linear buy cost); edge-adjacent preview helpers in `world/chunks/coords.ts` + `tests/pipeline-chunks.test.ts` — 2026-11-18.
- **Obscured preview chunks:** `world/chunks/match-layout.ts` + `Match`/frame `ownedChunks` / `previewChunks`; client dim overlay on preview; starter fire+water + outer circle sources — 2026-11-18.
- **Chunk buy:** `POST /api/rooms/:id/buy-chunk` + `WalletService.spend`; client **Comprar** buttons on visible preview chunks — 2026-11-18.
- **Moderation UI:** `pipeline-moderation.tsx` (sala, suspensão, BDFL).
- **Room chat:** `Room.chat` in SQLite; `POST /api/rooms/:id/chat`; SSE `chat`; sidebar `room-chat.tsx` + `room-collaborators.tsx`.
- **CMS chat moderation:** `/moderacao-chat`; `GET/DELETE /api/admin/rooms…/chat`; permission `room:chat:moderate`.
- **Generation clearance:** `geometry/clearance.ts` + `world/placement/` (`PlacementField`, gaps) — per-side pads at match creation — 2026-11-17.
- **Seeded initial layout:** `geometry/seed-rng.ts` + `layoutTwoStarterSources` in `world/placement/approach.ts` (room seed picks fire/water pair; clearance enforced) — 2026-11-17.

### Gaps / debt (fix in small PRs, not one blob)

**v0.1 polish**

- [x] Lobby vocabulary moved to **sala** / Open Pipeline (`pipeline-lobby.tsx`, `create-room-panel.tsx`) — 2026-03-25.
- [x] Dead **tree/Matter** client and physics removed from live routes — 2026-03-25; orphan **community/** and tree-scene client code **deleted from the tree** — 2026-11-17.
- [x] Tree-era [`game-server.test.ts`](../tests/game-server.test.ts) **removed** (file no longer in `tests/`) — 2026-11-17.
- [x] `npm run game:cli` **tree CLI removed** — 2026-03-25.
- [ ] Legacy SQLite rooms without `kind: "pipeline"` are **hidden** from list; no migration story documented for operators.
- [x] Minimal **Sala** moderation UI (participantes, propor suspensão, BDFL decide) — 2026-11-17.
- [ ] Pinch-zoom / pointer edge cases on `PipelineScene` need a real device pass.
- [x] Matter **tree** physics removed from the build path — 2026-03-25.

**Design / proposal alignment**

- [ ] Proposal milestone table still says `3×3` core — update proposal or add errata when user locks 5×5 for v0.1.
- [x] Dual unlock (demands + collaborators) shipped 2026-11-17; **collaborator gate retired** 2026-11-18 (demand-only auto **0.1 → 0.2**; admin `advance`).
- [x] Chunk TOML keys + `world/chunks/coords.ts` helpers/tests; Participantes unlock meter removed — 2026-11-18.
- [x] **Structure prices and pooled chunks:** belt/machine costs, passive cap vs wallet cap, and `buy-chunk` contributions — 2026-11-20. See [economy-expansion.md](economy-expansion.md) / [Decisions §11](../decisions.md#11-coins-and-chunk-expansion).
- [x] Git blame on belts: desktop hover + ~450ms long-press — 2026-11-17.
- [x] Canvas hover blame also covers combiners, splitters, and tunnels (same nickname readout) — 2026-11-20.

---

## Architecture map (keep accurate)

```text
game-server/pipeline/
  geometry/          direction, cell, clearance (generation pads), seed-rng
  machines/          Machine, Slot, Source (3×3), Core (5×5), Belt, Splitter (1×1), Tunnel portals
  packets/           Packet (circle only)
  world/             Match, frame, types; chunks/, placement/, tick/, edit/, progression/
  rules.ts           TypeScript mirror of TOML
  load-rules.ts      pipeline.toml validation

game-server/runtime/simulation-coordinator.ts   grid tick + SSE (no Matter)

src/components/game/pipeline/
  model/frame.ts     client PipelineFrame + rules helper
  hooks/             use-pipeline-stream.ts
  scene/             PipelineScene, camera, belt stroke, painters/
  pipeline-room.tsx  top bar + sidebar + canvas
  room-tutorial-overlay.tsx      first-visit stepped tutorial (SVG illustrations)
  tutorial-memory.ts             localStorage seen flag
  core-requirements-sidebar.tsx  version / demands (click → production-line overlay)
  production-line/               ancestry chart overlay for a requirement
  room-collaborators.tsx         compact avatar + name list
  room-chat.tsx                  per-room chat (SSE + POST)
  pipeline-moderation.tsx        sala ban proposals (BDFL)

Routes unchanged: /jogo/, /jogo/sala/?id=, /api/rooms
```

**Frame contract:** `PipelineFrame` in [`game-server/pipeline/world/frame.ts`](../game-server/pipeline/world/frame.ts) — persist in `Room.frame` (`State.rooms` in SQLite JSON; loads legacy `towers` key on read).

---

## Roadmap (do one version per review gate)

Work in order. Do not implement v0.2+ until the user reviews the previous version in browser.

| Version | Scope (from proposal) | Start after |
| --- | --- | --- |
| **v0.1** | Circle, belts, core; deliveries only (no crash) | — (current WIP) |
| **v0.2** | Triangle, splitters, mergers, map ring, more core ports | v0.1 reviewed |
| **v0.3** | Square, combiners, tunnels, nested shapes | v0.2 reviewed |
| **v0.4** | Diamond, modifiers, bugs, legacy zones | v0.3 reviewed |
| **v1.0** | Full central ports, first satellite core | v0.4 reviewed |
| **v1.x** | Federation to 9 cores, victory + export | v1.0 reviewed |

For each version, extend **machines/** with subclasses, add tick tests first, then HTTP + canvas, then update this doc’s **Done** and **Gaps** sections.

---

## Verification commands

```bash
node --test tests/pipeline-tick.test.ts tests/pipeline-http.test.ts tests/room-list.test.ts tests/game-config.test.ts
npm run game:dev    # one instance only (SQLite lock)
npm run dev         # needs CMS/content sync for full site
```

Manual: sign in → create room → drag belts source → core → see deliveries; confirm guest `place` returns 401; confirm the room never crashes from idle starvation.

---

## Changelog (agents: append newest at top)

| Date | Agent / human | Note |
| --- | --- | --- |
| 2026-11-20 | Gameplay | Tunnel ports plug into machine ports like splitters (`portsConnected`); logistics brackets hide on connect; machine brackets stay visible — `building-slots.ts`, `routing.ts` |
| 2026-11-20 | Gameplay | Auto-tunnels stay as short as the covered solids allow (exit right after the last included run) while still merging within `tunnel_max_gap` — `belt-cross.ts` |
| 2026-11-20 | Gameplay | Belt-drag auto-tunnel when the stroke starts and ends on cells adjacent to the crossed conveyor line (no extra lead-in/out belts) — `belt-cross.ts` |
| 2026-11-20 | Gameplay | Belt-drag tunnels prefer one span within `tunnel_max_gap` (no split on wide free gaps); gap `0` adjacent portals + instant carry — `belt-cross.ts`, `routing.ts`, `tunnel-machine.ts` |
| 2026-11-20 | Gameplay | Tunnel body contact no longer blocks auto-tunnel near buildings; port overlap + linked slots still gate illegal port cells — `building-slots.ts` |
| 2026-11-20 | Design | Port connection locked: direct plug on input slot + matching `travel`; shared gap cells are belts; tick routing aligned — [decisions §9](../decisions.md#9-open-pipeline-machines), `building-slots.ts`, `routing.ts` |
| 2026-11-20 | UX | First-visit room tutorial overlay (**Primeiros passos**) with SVG illustrations; `localStorage` + reopen from **?** help — `room-tutorial-overlay.tsx` |
| 2026-11-20 | Design | Brackets: hide logistics only on `portsConnected`; core/combiner always visible (second paint pass); source output stays under the circle — `machine-painter.ts` |
| 2026-11-20 | Design | Splitter body-adjacent only with compatible plug; tunnel body-adjacent only with feed/accept link; combiners in all rooms — `building-slots.ts`, `machine-editor.ts` |
| 2026-11-20 | Gameplay | Tunnel placement keeps surface belts between portals; stroke facing before portal belts — `machine-editor.ts` |
| 2026-11-20 | Gameplay | A tunnel may touch a machine when an output feeds the entrance or an input accepts the exit; belt drag treats that port as the missing lead-in or lead-out belt — `building-slots.ts`, `belt-cross.ts` |
| 2026-11-20 | Gameplay | Building I/O ports must not occupy another building’s body (inputs use approach cell; shared port tiles allowed) — `building-slots.ts` |
| 2026-11-19 | Gameplay | Belt drag inserts tunnels across runs that fit in `tunnel_max_gap` by default (1–2 empty cells stay in the span). Thicker runs and missing portal cells are skipped — `belt-cross.ts` |
| 2026-11-20 | Impl | Per-shape demand escalation for all active shapes (`escalationWaveByShape`, `escalation_ratio = 2`); global `escalationWave` for **Onda** — [progression.md](progression.md) |
| 2026-11-20 | Impl | Satellite cores discovered on preview (not owned at create) — [progression.md](progression.md) |
| 2026-11-20 | Design | Outer chunks may roll starter bases (fire/water) via `source_spawn_chance_percent` — [progression.md](progression.md) / §11 |
| 2026-11-20 | Design | Owned at create = starter only; grass stays preview until bought — [progression.md](progression.md) |
| 2026-11-20 | Design | Progression locked: permanent prior demands, 3 cores (Chebyshev ring 3–4), agnostic ports, grass neighbor guarantee; core gears spin only after intake — [progression.md](progression.md) |
| 2026-11-19 | Gameplay | Splitter 1×1 (1-in/3-out RR) + Factorio tunnels (`tunnel_max_gap`) in all rooms; QuiverAI decor; tests `pipeline-splitter` / `pipeline-tunnel` — early vs proposal v0.2/v0.3 |
| 2026-11-19 | Design | Element book: kiln fires clay into brick (tier-4 byproduct); lightning and scrap move to tier 4; tier-5 capstones consume those byproducts (tempest, forge) — `elements.md` / decisions §10 |
| 2026-11-19 | UX | Core requirements clickable → production-line ancestry overlay (`production-line/`); circle fallback; docs §10 / elements.md |
| 2026-11-18 | Design | Outer sources optional (per-base `source_spawn_chance_percent` in `elements.toml`); clearance on at gen; spawn roll deferred — §11 |
| 2026-11-18 | Design | Starter chunk places `starter_source_ids` (fire + water); packets stay `circle` until elements ship — §11 / economy-expansion.md |
| 2026-11-18 | Impl | Shared element catalog loader on `rules.elements`; TOML-driven starters/chapters/machines/presentation — §10 |
| 2026-11-18 | Progression | Collaborator unlock gate removed; chunk config + `chunks.ts` scaffolding; economy/expansion docs (§11) — runtime buy/gen/coins still open |
| 2026-11-18 | Design | Planned (docs only): 36 elements, tier 5, 3-in/2-out machines with coupled dual eject + half-rate split; ancestry chart layout known-bad — see `elements.md` / decisions §10 |
| 2026-11-17 | Ops | CMS Moderação do chat (`/moderacao-chat`) deletes/clears via game admin APIs |
| 2026-11-17 | UX | Room sidebar chat (`POST …/chat` + SSE `chat`) and compact collaborators block |
| 2026-11-17 | Progression + UX | Dual unlock (`unlock_collaborators=2`), admin advance, sala ban UI, long-press belt blame |
| 2026-11-17 | UX | Core requirements moved to room sidebar (`CoreRequirementsSidebar`); canvas keeps git blame only |
| 2026-11-17 | Design | Removed stability bar and crash/game over; progression (cumulative prior demands) is what keeps older supplies necessary |
| 2026-11-17 | Docs + cleanup | Architecture docs match pipeline-only tree; tree/Matter orphans and `game-server.test.ts` gone |
| 2026-11-16 | Initial handoff | v0.1 WIP: 5×5 core, modular pipeline server, canvas client, partial UI rename to Open Pipeline |
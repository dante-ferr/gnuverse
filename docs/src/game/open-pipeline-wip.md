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
3. **Do not** mark a stage complete without: targeted tests green (`tests/pipeline-*.test.ts` at minimum), manual smoke on `/jogo/torre/?id=`, and config numbers still in TOML not TS.
4. If you change HTTP actions, frame shape, or machine geometry, update the **Architecture map** section below in the same change.

---

## Current version: v0.1 (under review)

### Intent

One room, one **3×3** circle source, player-built belts, a **5×5 central core** with **12 input slots** (three central tiles per face, corners solid). Server tick moves packets simultaneously; deliveries accumulate with **no stability bar and no crash**. CMS login required to place or remove belts. In-world readouts on the core (no gameplay sidebar).

**Progression pressure (proposal, not v0.1 code yet):** when more packet types are demanded, prior supplies stay required. Dropping an older line does not end the match — it blocks leveling up because the delivery milestone needs every demanded type.

### Repo decisions that differ from the proposal doc

| Topic | Proposal (staged vision) | This repo (v0.1 WIP) |
| --- | --- | --- |
| Core footprint | Starts `3×3`, grows with versions | Fixed **5×5** now; see `CoreMachine` |
| Source footprint | Unspecified / 1 cell implied | Fixed **3×3** with one face-center output; see `SourceMachine` |
| Active core ports | Milestone-gated (e.g. 2 ports at start) | **All 12** inputs accept deliveries in v0.1 |
| Machine art | Proposal: procedural for geometric visuals | Cell-fit body + “[” slots procedural; color-agnostic SVG decor only — [Decisions §9](../decisions.md#9-open-pipeline-machines) |
| Collaborators | `localStorage` token option | **CMS accounts only**; `join` records nickname |
| Building cost | Cheap, no coin gate | Belts do **not** spend wallet coins yet |
| Fail / victory | No crash; victory at 9 cores | **No fail state**; no victory screen |

### Done (implemented)

- **Server sim:** `game-server/pipeline/` — `Machine` / `SourceMachine` / `CoreMachine` / `BeltMachine`, `Match`, `Movement`, `Emission`, `BeltEditor` (no `StabilityMeter`).
- **Config:** `[pipeline]` in [`game.config.toml`](../game-server/config/game.config.toml), loaded via [`pipeline/load-rules.ts`](../game-server/pipeline/load-rules.ts).
- **HTTP:** `POST /api/towers/:id/place`, `remove`, `join`; SSE `frame` pushes `PipelineFrame`.
- **Client:** `src/components/game/pipeline/` — canvas scene, painters, drag belts, pan/zoom; room at `/jogo/torre/` via `PipelineRoom`.
- **Art:** dark grid / light machines; procedural bodies/slots; `core-decor.svg` (accent details) + `resource-<shape>.svg` on sources; stroke = `decor_stroke_width`.
- **Tests:** [`tests/pipeline-tick.test.ts`](../tests/pipeline-tick.test.ts), [`tests/pipeline-http.test.ts`](../tests/pipeline-http.test.ts).
- **Generation clearance:** `geometry/clearance.ts` + `world/map-layout.ts` — per-side pads at match creation — 2026-11-17.
- **Seeded initial layout:** `geometry/seed-rng.ts` + procedural `layoutInitialMachines` (room seed picks approach + offset; clearance enforced) — 2026-11-17.

### Gaps / debt (fix in small PRs, not one blob)

**v0.1 polish**

- [x] Lobby vocabulary moved to **sala** / Open Pipeline (`pipeline-lobby.tsx`, `create-room-panel.tsx`) — 2026-03-25.
- [x] Dead **tree/Matter** client and physics removed from live routes — 2026-03-25; orphan **community/** and tree-scene client code **deleted from the tree** — 2026-11-17.
- [x] Tree-era [`game-server.test.ts`](../tests/game-server.test.ts) **removed** (file no longer in `tests/`) — 2026-11-17.
- [x] `npm run game:cli` **tree CLI removed** — 2026-03-25.
- [ ] Legacy SQLite rooms without `kind: "pipeline"` are **hidden** from list; no migration story documented for operators.
- [ ] Room UI dropped **governance/community** panels; ban proposals still exist server-side — decide per version whether to restore a minimal in-room UI.
- [ ] Pinch-zoom / pointer edge cases on `PipelineScene` need a real device pass.
- [x] Matter **tree** physics removed from the build path — 2026-03-25.

**Design / proposal alignment**

- [ ] Proposal milestone table still says `3×3` core — update proposal or add errata when user locks 5×5 for v0.1.
- [ ] Dual unlock (deliveries + unique collaborators) and solo 45s fallback — **not started**.
- [ ] Git blame on belts exists as `authorNickname` in frame; hover on desktop only.

---

## Architecture map (keep accurate)

```text
game-server/pipeline/
  geometry/          direction, cell, clearance (generation pads), seed-rng
  machines/          Machine, Slot, Source (3×3), Core (5×5), Belt
  packets/           Packet (circle only)
  world/             Match, map-layout, frame, Movement, Emission, BeltEditor
  rules.ts           TypeScript mirror of TOML
  load-rules.ts      [pipeline] validation

game-server/runtime/simulation-coordinator.ts   grid tick + SSE (no Matter)

src/components/game/pipeline/
  model/frame.ts     client PipelineFrame + rules helper
  hooks/             use-pipeline-stream.ts
  scene/             PipelineScene, camera, belt stroke, painters/
  pipeline-room.tsx  top bar + full-viewport canvas

Routes unchanged: /jogo/, /jogo/torre/?id=, /api/towers
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
| 2026-11-17 | Design | Removed stability bar and crash/game over; progression (cumulative prior demands) is what keeps older supplies necessary |
| 2026-11-17 | Docs + cleanup | Architecture docs match pipeline-only tree; tree/Matter orphans and `game-server.test.ts` gone |
| 2026-11-16 | Initial handoff | v0.1 WIP: 5×5 core, modular pipeline server, canvas client, partial UI rename to Open Pipeline |
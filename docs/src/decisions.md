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
| Body | Axis-aligned rectangle that **exactly** fills `width × height` cells |
| Slots | “[”-shaped protuberances from `Machine.slotBracket`; may stick slightly past the body; **one cell** wide along the face. **Inputs** use a shallower protrusion (`slot_input_depth_percent`) and a plain bracket. **Outputs** use a deeper one (`slot_output_depth_percent`); output spines include a chevron tip along `slot.travel` (`slot_flow_mark_depth_percent`), same fill and outline as the bracket |
| Core | **5×5**; 12 inputs (three central tiles per face; corners solid) |
| Source | **3×3**; single output on the **center cell of the facing edge**, one step outside along `direction` |
| Decor SVG | Black ink (`#000000`) on transparent under `public/pipeline/`. **New or replacement machine decor must be generated with QuiverAI** (do not hand-draw substitutes unless the user asks). Thick strokes use `[pipeline] decor_stroke_width` (512 viewBox) with thinner companion strokes (6 or 8) for detail. At draw time each machine tints its decor to a **darker tone of that machine’s body color** via `darkenHex(body, decor_darken_percent)`. Core uses `core-decor.svg`; source body uses `source-decor.svg` (no resource glyph on the body) |
| Colors | Body: core **white** (`color_core`), source **site accent** (`color_source`, `color_accent` / `#52d6c9`). **Decor ink** is dynamic: multiply RGB by `(100 − decor_darken_percent) / 100` (default `decor_darken_percent = 35` in `[pipeline]`). `color_decor` remains in the palette for future UI only — it is **not** the machine overlay tint. Extended GNUverse palette keys (`color_surface`, `color_muted`, `color_highlight`, `color_warning`, `color_success`, `color_ink`, etc.) live in `[pipeline]` for future painters. Global near-black outline on bodies, slots, packets, and glyphs: `outline_width_px`, `color_outline` (darkest ink). Resource symbol is **screen-space**: `resource_glyph_size_px`, **filled white disk** + dark outline, subtler orbit (`resource_glyph_orbit_px`, `resource_glyph_orbit_ms`). Packets use `color_packet` |
| Belts | Procedural tracks only; no decor SVG; **no** outline or under-stroke — belt color and chevron only. Ends are square and stop on the cell edge. Chevrons move in the belt direction and are clipped to that cell |
| Clearance (generation) | Per-side depth = `max(machine_clearance_min, I/O ports on that face)`; full rectangular AABB pad (corners included); free pads of different machines must not overlap; applies only when the match layout is generated — belts may use those cells afterward |
| Core extra | `core_clearance_extra` from `[pipeline]` TOML is added on **every** core side on top of port-based depth |
| Initial layout | **Seeded procedural:** `Match.create` hashes the room id / seed to pick one valid placement among the four cardinal approaches (side facing the core plus offset along that face). Clearance pads are enforced the same way on every candidate |

Gameplay loop detail: [Rules and design](game/rules.md).

## Still open

| Item | When it resolves |
| :--- | :--- |
| Supabase / Render / Cloudflare accounts and a real publish cycle | Before opening the site to the public |
| SMTP and anti-spam for broad registration | Before advertising external signup |
| `game-server` hosting with a volume | Before `/jogo/` in production |
| 14 posts + logbook + accessibility | By delivery (2026-12-02) |
| Aligned human editorial criteria | Before batch publishing |

Operational detail: [Roadmap](engineering/roadmap.md).

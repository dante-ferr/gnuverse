<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Make-centric workflow

This repo is **make-centric**. Prefer `make <target>` over raw `npm run` for day-to-day commands (`make help` lists them). When you add a new local tool or long-running preview, wire a Makefile target and document that `make` name — do not leave npm-only instructions as the primary path.

## Open Pipeline

The playable game is Open Pipeline v0.1, specified in [`docs/src/game/open-pipeline-proposal.md`](docs/src/game/open-pipeline-proposal.md). Read [`game-server/config/game.config.toml`](game-server/config/game.config.toml) before changing numbers. Splitters, tunnels, and combiners are available in all rooms. Progression (cumulative chapter demands, three cores in a Chebyshev ring 3–4, starter-only ownership at create, grass in a preview neighbor) is documented in [`docs/src/game/progression.md`](docs/src/game/progression.md) and wired for normal rooms. Element catalog (36 resources, tier 5) is authored in [`game-server/config/elements.toml`](game-server/config/elements.toml) and loaded into `rules.elements` via the shared catalog loader; preview with `make elements-serve`. Starters, chapters, machines, and presentation keys live in that TOML — do not hardcode element ids in TypeScript. See [`docs/src/game/elements.md`](docs/src/game/elements.md) and [`docs/src/decisions.md`](docs/src/decisions.md) §10.

### Stack and URLs (keep as-is)

- Static lobby at `/jogo/`, room URL `/jogo/torre/?id=<uuid>`, CMS login, separate Node **game-server**, SQLite, server-authoritative state over **SSE**. The grid tick does not use Matter.js.
- Do **not** rename `/jogo/torre/` or `/api/towers`. Do **not** add a Rust service, WebSockets, or an in-memory-only store.
- Prefer `make dev` / `make cms` / `make site` over starting processes by hand. Game API alone is still `npm run game:dev` when needed. Do **not** start a second game API while one is running (SQLite: "Já existe uma instância do jogo usando este banco.").
- Login uses the real CMS identity provider. Only a signed-in account can place or delete belts. The test identity provider is for unit tests only.

### v0.1 rules

- One **3×3** source footprint and a **5×5** central core; two satellite cores are discovered in a Chebyshev ring 3–4 when players expand. Each core face has three input slots on the central tiles. Corners are solid, so each core has 12 inputs. Each source emits from the center of its facing edge.
- Players drag unidirectional belts. Each cell holds one packet.
- The server moves packets simultaneously. Packets do not swap. An open core slot consumes a demanded element packet and counts a delivery.
- No stability bar and no crash / game over. Deliveries accumulate; prior chapter demands stay active so dropping an older supply blocks leveling up rather than ending the match. There is no victory screen yet.
- All gameplay and presentation numbers live in the `[pipeline]` table and reach the client on the rules payload. Do not hardcode them in TypeScript. `game:dev` watches `game.config.toml` and hot-reloads `[pipeline]` on save (invalid edits keep the previous rules).
- In-room copy is Portuguese. The room sidebar has pages **Jogo**, **Participantes**, and **Decisões**; chat lives in a collapsible left sidebar. Git blame on belts stays on the canvas hover label.
- **Placeable structures:** register each structure in [`src/components/game/pipeline/structures/`](src/components/game/pipeline/structures/) (`registerStructure` + side-effect import from `index.ts`). Registration must drive the Jogo sidebar (label + icon) and create-mode placement/`commit` — do not hardcode structure entries in the palette or scene. Add a black-ink SVG under `public/pipeline/` for the sidebar icon.
- **Machine presentation and footprints:** [`docs/src/decisions.md`](docs/src/decisions.md) §9 Open Pipeline machines. **Gameplay loop:** [`docs/src/game/rules.md`](docs/src/game/rules.md). When implementing or changing machine art, palette, outlines, belts presentation, or resource glyphs, **read §9 before inventing** — do not invent art rules from memory or this file’s short bullets.
- **Player achievements:** record every gameplay achievement in the room event history via `HistoryService` (`actorId` + event type). Player history is that log filtered by actor — do not invent a parallel store. Client UIs (for example the Participantes overlay) read these events. At minimum record belt placement (`place` with `structure: 'belt'`), machine placement (`machine-place` when placeable machines ship), and chunk purchases (`chunk-buy`).

### Agent workflow

- Unset game-design choices: ask the user before inventing rules.
- Prefer a **composer-2.5** subagent for mechanical edits.
- Do not commit unless the user asks.

## Method book

- Team method authority: `docs/` (mdBook). Preview with `make docs-serve` (`http://localhost:3003`).
- External course brief: `docs/references/trabalho-multimodal-2026.2.pdf`. Do not copy the brief into chapters.
- Conflicts: the brief wins for the problem statement; the book wins for team method; if code and book disagree on method, update the book when the method changed, or the code when the book still defines the method.
- Book language: English (`docs/book.toml`).

## Language

- **UI only in Portuguese** (labels, copy, user-facing errors, blog and game text shown in the browser).
- **Code and documentation in English** (identifiers, comments, commit messages, this file, the mdBook, READMEs aimed at developers).

## Authentication UX

- When a control asks the user to sign in or register, **redirect to a dedicated login or registration page**.
- Do not embed login or registration forms inline where the action was requested (for example, do not keep a full auth form inside the blog submission panel or a game panel). Link or navigate to the shared auth pages instead.

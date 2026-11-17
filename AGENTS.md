<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Open Pipeline

The playable game is Open Pipeline v0.1, specified in [`docs/src/game/open-pipeline-proposal.md`](docs/src/game/open-pipeline-proposal.md). Read [`game-server/config/game.config.toml`](game-server/config/game.config.toml) before changing numbers. Later versions (splitters, nested shapes, satellite cores, victory) wait until the current version is reviewed.

### Stack and URLs (keep as-is)

- Static lobby at `/jogo/`, room URL `/jogo/torre/?id=<uuid>`, CMS login, separate Node **game-server**, SQLite, server-authoritative state over **SSE**. The grid tick does not use Matter.js.
- Do **not** rename `/jogo/torre/` or `/api/towers`. Do **not** add a Rust service, WebSockets, or an in-memory-only store.
- `npm run game:dev` = game API; `npm run dev` = Next. Do **not** start a second `npm run game:dev` while one is running (SQLite: "Já existe uma instância do jogo usando este banco.").
- Login uses the real CMS identity provider. Only a signed-in account can place or delete belts. The test identity provider is for unit tests only.

### v0.1 rules

- One **3×3** circle source and a **5×5** central core. Each core face has three input slots on the central tiles. Corners are solid, so the core has 12 inputs. The source has one output on the center of its facing edge.
- Players drag unidirectional belts. Each cell holds one packet. The oldest belt past the tile cap is removed.
- The server moves packets simultaneously. Packets do not swap. An open core slot consumes a circle and counts a delivery.
- No stability bar and no crash / game over. Deliveries accumulate; later versions keep prior packet demands active so dropping an older supply blocks leveling up rather than ending the match. There is no victory screen yet.
- All gameplay and presentation numbers live in the `[pipeline]` table and reach the client on the rules payload. Do not hardcode them in TypeScript. `game:dev` watches `game.config.toml` and hot-reloads `[pipeline]` on save (invalid edits keep the previous rules).
- Dark background, light machines. Bodies and “[” slots are procedural with global `color_outline` / `outline_width_px`. Decor SVGs tint to `color_decor` (deep ink darker than body fills); thick strokes use `decor_stroke_width`; extended palette keys live in `[pipeline]` TOML. Sources show a screen-space filled white resource disk on a subtler orbit (`resource_glyph_orbit_px`). Belts are procedural (belt color + chevron, no outline); packets stay procedural with outline. In-room copy is Portuguese. Core requirements (version, deliveries, collaborators, demanded shapes) sit in a room sidebar; on mobile the same panel stacks under the canvas. Git blame on belts stays on the canvas hover label.
- **Machine presentation and footprints:** [`docs/src/decisions.md`](docs/src/decisions.md) §9 Open Pipeline machines. **Gameplay loop:** [`docs/src/game/rules.md`](docs/src/game/rules.md).

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

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Make-centric workflow

This repo is **make-centric**. Prefer `make <target>` over raw `npm run` for day-to-day commands (`make help` lists them). When you add a new local tool or long-running preview, wire a Makefile target and document that `make` name — do not leave npm-only instructions as the primary path.

## Open Pipeline

The playable game is Open Pipeline v0.1, specified in [`docs/src/game/open-pipeline-proposal.md`](docs/src/game/open-pipeline-proposal.md). Read [`game-server/config/pipeline.toml`](game-server/config/pipeline.toml) (gameplay/presentation) and [`game-server/config/game.config.toml`](game-server/config/game.config.toml) (server/lobby/chat) before changing numbers. Splitters, tunnels, and combiners are available in all rooms. Progression (cumulative chapter demands, three cores in a Chebyshev ring 3–4, starter-only ownership at create, grass in a preview neighbor) is documented in [`docs/src/game/progression.md`](docs/src/game/progression.md) and wired for normal rooms. Element catalog (36 resources, tier 5) is authored in [`game-server/config/elements.toml`](game-server/config/elements.toml) and loaded into `rules.elements` via the shared catalog loader; preview with `make elements-serve`. Starters, chapters, machines, and presentation keys live in that TOML — do not hardcode element ids in TypeScript. See [`docs/src/game/elements.md`](docs/src/game/elements.md) and [`docs/src/decisions.md`](docs/src/decisions.md) §10.

### Stack and URLs (keep as-is)

- Static lobby at `/jogo/`, room URL `/jogo/sala/?id=<uuid>`, CMS login, separate Node **game-server**, SQLite, server-authoritative state over **SSE**. The grid tick does not use Matter.js.
- Keep stack URLs `/jogo/sala/?id=<uuid>` and `/api/rooms`. Do **not** add a Rust service, WebSockets, or an in-memory-only store.
- Prefer `make dev` / `make cms` / `make site` over starting processes by hand. Game API alone is still `npm run game:dev` when needed. Do **not** start a second game API while one is running (SQLite: "Já existe uma instância do jogo usando este banco.").
- Login uses the real CMS identity provider. Only a signed-in account can place or delete belts. The test identity provider is for unit tests only.

### v0.1 rules

- One **3×3** source footprint and a **5×5** central core; two satellite cores are discovered in a Chebyshev ring 3–4 when players expand. Each core face has three input slots on the central tiles. Corners are solid, so each core has 12 inputs. Each source emits from the center of its facing edge.
- Players drag unidirectional belts. Each cell holds one packet.
- The server moves packets simultaneously. Packets do not swap. An open core slot consumes a demanded element packet and counts a delivery.
- No stability bar and no crash / game over. Deliveries accumulate; prior chapter demands stay active so dropping an older supply blocks leveling up rather than ending the match. There is no victory screen yet.
- All gameplay and presentation numbers live in `pipeline.toml` and reach the client on the rules payload. Do not hardcode them in TypeScript. `game:dev` watches `pipeline.toml`, `game.config.toml`, and `elements.toml` and hot-reloads on save (invalid edits keep the previous rules).
- In-room copy is Portuguese. The room sidebar has pages **Jogo**, **Participantes**, and **Decisões**; chat lives in a collapsible left sidebar. Git blame on belts stays on the canvas hover label.
- **Placeable structures:** register each structure in [`src/components/game/pipeline/structures/`](src/components/game/pipeline/structures/) (`registerStructure` + side-effect import from `index.ts`). Registration must drive the Jogo sidebar (label + icon) and create-mode placement/`commit` — do not hardcode structure entries in the palette or scene. Add a black-ink SVG under `public/pipeline/` for the sidebar icon.
- **Machine presentation and footprints:** [`docs/src/decisions.md`](docs/src/decisions.md) §9 Open Pipeline machines. **Gameplay loop:** [`docs/src/game/rules.md`](docs/src/game/rules.md). When implementing or changing machine art, palette, outlines, belts presentation, or resource glyphs, **read §9 before inventing** — do not invent art rules from memory or this file’s short bullets.
- **Checkpoints and decisions:** spend-triggered factory checkpoints, restore proposals, contributor agreement, and the owner vs. majority settings are specified in [`docs/src/game/checkpoints.md`](docs/src/game/checkpoints.md).
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

## UI & Visual Design System

### Visual Direction & Surfaces
- **Theme:** Dark mode using neutral charcoal/graphite surfaces instead of blue-tinted slate.
  - Page canvas (`--background`): neutral dark charcoal (e.g. `#111214` or `#121315`).
  - Elevated surface (`--surface`): `#181a1d`; interactive/raised surface (`--surface-raised`): `#202327`.
  - Structural borders (`--line`): subtle neutral gray (`#2a2e33`) with 1px solid hairlines.
- **Surface hierarchy:** Differentiate layers through background value shifts and 1px borders—do not rely on drop shadows (`shadow-lg`, `shadow-xl`) or translucent glass effects (`backdrop-blur`) to separate containers.
- **Preserve game tokens:** Do not rename or modify `--scene`, `--scene-line`, `--ground`, `--ground-edge`, or `--block-face` in `globals.css`.

### Typography
- Load an intentional neo-grotesque sans-serif via `next/font/google` in `src/app/layout.tsx` (e.g., `IBM Plex Sans` or `Plus Jakarta Sans`) and a clean monospace font (`IBM Plex Mono` or `JetBrains Mono`) mapped to `--body-font` and `--display-font` / `--font-mono`.
- **Headings (`h1`, `h2`, `h3`):** Always use the sans-serif font, never monospace. Apply tight letter-spacing (`tracking-tight` / `-0.02em`), line-height between `1.05` and `1.2`, and semibold/bold weight (`600`–`700`).
- **Monospace usage:** Restrict monospace strictly to code snippets, tabular numbers (`tabular-nums`), URLs, and short technical metadata (max 1–2 words, e.g., timestamps or counters). Do not use monospace for section titles, marketing slogans, or uppercase eyebrow tags.
- **Body copy:** Max line length of `60ch`–`68ch` for readability; use `--muted` for secondary text with sufficient contrast (at least WCAG AA against `--background` and `--surface`).

### Color & Emphasis
- **Accent restraint (`--accent`):** Reserve the primary accent color for primary action buttons, active navigation indicators, text links inside prose, and `:focus-visible` outlines.
- **No partial headline tinting:** Keep headlines in a single foreground color (`--ink`). Do not color individual words inside an `h1` or `h2` for decorative emphasis.
- **No decorative gradients:** Do not use linear or radial gradients (`bg-gradient-to-*`) on backgrounds, buttons, borders, or text.

### Layout, Spacing & Controls
- **Consistent geometry:** Standardize border-radius across all UI controls (buttons, inputs, selects, cards) to a single scale: `4px` (`rounded`) or `6px` (`rounded-md`). Do not mix sharp `0px` buttons on one page with rounded buttons on another.
- **Visual content rule:** Never add purely decorative HUD/sci-fi graphics (corner brackets, fake coordinates like `N 01 / 07`, or abstract node-and-line diagrams). Every visual block must display real application data, functional navigation, or domain-relevant editorial content.
- **Alignment & density:** Use an explicit grid with consistent horizontal padding and vertical rhythm. Prefer structured lists with 1px horizontal dividers over grids of identical floating cards when presenting 2–4 items.

### Space Atmospheric Background (Home Page)
- **Contrast & Visibility**: The starfield must be clearly visible against the dark charcoal background. Use bright, tiny star particles (1px to 2.5px) with opacity ranging from `0.2` to `0.85` scattered across the viewport, rather than extremely faint dots. Apply active, asynchronous twinkling animations to at least 30% of them.
- **Shooting Stars (Estrelas Cadentes)**:
  - Implement a few sparse, fast-moving "shooting star" effect lines. 
  - They must travel quickly along a diagonal path (e.g. from top-left to bottom-right) leaving a sharp, faded linear streak of light (colored with a mix of `--accent` and white) that lasts less than 1.5s, appearing at random intervals (e.g. every 8 to 20 seconds) in unpredictable screen locations.
  - Limit the active count to never have more than 1 or 2 visible at the exact same time, ensuring they remain an occasional event rather than constant clutter.
- **Atmospheric Nebulae & Gradients**: Use a subtle, large radial-gradient backglow (max `12%` opacity, transitioning from `--accent`/blue-cyan to transparent) centered behind the constellation on the right, plus smaller fades on the edges to eliminate any flat, washed-out matte appearance. Keep the area directly behind the main hero text on the left less dense for maximum readability.
- **Orbits & Circles**: Increase the visible weight and opacity (around `0.25`) of the fine, concentric orbit-like lines to solidify the celestial map artwork.
- **Accessibility**: Ensure all movement (twinkling and shooting stars) is strictly wrapped in `prefers-reduced-motion: reduce` checks to pause animations for users who need them disabled.

### Interior & Content Pages (`/blog/`, `/artigos/`, `/quizzes/`, `/jogo/`)
- **Ambient starfield on content pages:** Keep a lightweight, low-density twinkling starfield behind interior pages (most noticeable in the side margins) to unify the GNUverse identity. Reserve constellations, orbit arcs, and shooting stars strictly for the Home page.
- **No redundant back links:** Do not add a top-level `← GNUverse` link on main section pages when `SiteHeader` is already visible. (Back links are fine inside detail pages, e.g., an individual article returning to `/blog/`.)
- **Flat filter/search toolbars:** Do not wrap search inputs, selects, and view toggles inside an extra outer bordered container ("box-inside-a-box"). Place controls directly on the canvas aligned to the page grid, separated from content by spacing or a single 1px horizontal divider (`--line`).
- **Editorial cards:** Use full-bleed `16:9` cover thumbnails flush with the top edge of the card (`overflow: hidden`, `object-cover`, no inner padding around the image). Keep card padding (`16px`–`20px`) strictly for the text body (metadata in `--muted`, title in `IBM Plex Sans`, short excerpt).
- **Respect global tokens:** Do not override `--background`, `--surface`, or `h1`/`h2`/`h3` font-family in page-level CSS modules with legacy slate colors or monospace headings.
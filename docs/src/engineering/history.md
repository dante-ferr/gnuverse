# History

Lab notebook: what was tried and what stayed. Current method: Blog and Game chapters.

## 2026-10-14 — Next base + GNUverse theme

### Setup
Next.js App Router, TypeScript, Tailwind scaffolding; brief reading with AI assistance; name and theme set by the user.

### Result
Provisional page and task-split sketch. Academic content stays with the group.

### Decision
**Kept** as the repository base.

## 2026-10-14 — Static site + Payload CMS

### Setup
Separate cloud CMS and exported site; Payload with roles, build sync, covers, deploy hook; manual demo.

### Result
Reader path independent of CMS wake-up. Production credentials unused.

### Decision
**Kept**; later evolved to `author`/`reviewer`, `/blog/` panel, and shared identity.

## 2026-10-21 — Towers + parallel blog

### Setup
Two experiences; coins, BDFL/voting, 14 posts, external approval.

### Result
Design documentation; game not implemented on that date.

### Decision
**Kept** as product. Local `game-server/` implementation came later (current state in the game chapters).

## Alternate game proposal (Open Pipeline)

Local brainstorm (formerly under `docs/local/`, outside the current method): top-down grid logistics, victory with 9 cores, unlocks by deliveries + unique collaborators, procedural canvas rendering and SVG only for HUD.

### Decision
**Abandoned** for current scope — the living method is side-view collaborative towers. Resume only with an explicit team decision.

## 2026-11-15–16 — Docs as mdBook

### Setup
Consolidate flat `docs/*.md` plus the `paulo/` folder into `docs/src` + `book.toml`; PDF under `docs/references/`.

### Result
Single method authority; `make docs-serve` on port 3003.

### Decision
**Kept** — current book structure.

## 2026-11-16 — Book and AGENTS in English

### Setup
Translate the method book and `AGENTS.md` to English. Record: UI Portuguese only; code and docs English; auth redirects to dedicated login/register pages.

### Decision
**Kept**.

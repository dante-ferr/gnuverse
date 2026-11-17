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
Design documentation; side-view towers with Matter.js later landed in `game-server/` as an early prototype.

### Decision
**Superseded** as the playable product by Open Pipeline (see below). Lobby URLs (`/jogo/torre/`) and `/api/towers` naming **remain by decision**. Dead Matter/tree tower code and orphan UI were **removed** from the repo; operational gaps (migrations, governance UI) stay in [`open-pipeline-wip.md`](../../open-pipeline-wip.md).

## Open Pipeline (current playable game)

### Setup
Top-down cooperative logistics: belts, circle packets, 5×5 core; no stability crash. Server sim in `game-server/pipeline/`; canvas client in `src/components/game/pipeline/`. Spec and handoff: [`open-pipeline-proposal.md`](../../open-pipeline-proposal.md), [`open-pipeline-wip.md`](../../open-pipeline-wip.md).

### Result
v0.1 playable slice on `feat/game` (under review). CMS login required to place or remove belts.

### Decision
**Kept** as the living game method. Do not restore Matter towers as the product without an explicit team decision.

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

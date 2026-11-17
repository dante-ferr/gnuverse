# Game code map

Page `/jogo/` on the static site; rules and state in `game-server/`.

## Frontend (`src/components/game/`)

| Area | Key files |
| :--- | :--- |
| Entry | `src/app/jogo/page.tsx`, `tower-game.tsx` |
| Transport | `api/game-api.ts` (HTTP + SSE) |
| Hooks | session, lobby, stream, feedback |
| Construction | SVG scene, controls, create tower |
| Account | auth UI (must redirect to dedicated login/register pages) |
| Community | history, members, proposals, rules |

## Backend (`game-server/`)

| Area | Role |
| :--- | :--- |
| `index.ts` / `server.ts` | Process and composition |
| `transport/` | HTTP routes, CORS |
| `auth/` | Sessions; `CMSIdentityProvider` |
| `towers/` + `governance/` | Towers, votes, bans, restore |
| `economy/` + `wind/` | Wallet and wind |
| `runtime/` | Simulation + SSE |
| `persistence/` | SQLite WAL + single-writer lock |
| `physics/` | Matter.js |
| `config/game.config.toml` | Prototype parameters |

Invalid TOML or out-of-range values **abort** startup. The UI may display rules; the server revalidates before writing.

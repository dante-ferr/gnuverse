# Game code map

Page `/jogo/` on the static site; authoritative match state in `game-server/pipeline/`; room UI in `src/components/game/pipeline/`. HTTP routes remain under `/api/towers`.

## Frontend

| Area | Key files |
| :--- | :--- |
| Lobby entry | `src/app/jogo/page.tsx`, `tower-game.tsx` (lobby shell; tree scene is orphaned) |
| Room | `pipeline/pipeline-room.tsx` — top bar + full-viewport canvas |
| Scene | `pipeline/scene/` — `PipelineScene`, camera, belt stroke, painters |
| Stream | `pipeline/hooks/use-pipeline-stream.ts` |
| Frame types | `pipeline/model/frame.ts` |
| Transport | `api/game-api.ts` (HTTP + SSE) |
| Auth | Dedicated login/register pages (see `AGENTS.md`); no inline auth in the room |

## Backend (`game-server/`)

| Area | Role |
| :--- | :--- |
| `pipeline/` | Grid sim: machines, packets, match, movement, emission, belts, stability |
| `pipeline/load-rules.ts` | Validates `[pipeline]` from TOML |
| `runtime/simulation-coordinator.ts` | Grid tick + SSE (no Matter) |
| `transport/` | HTTP routes, CORS |
| `auth/` | Sessions; `CMSIdentityProvider` |
| `persistence/` | SQLite WAL + single-writer lock |
| `config/game.config.toml` | All gameplay and presentation knobs |

### Pipeline layout

```text
game-server/pipeline/
  geometry/          direction, cell keys
  machines/          Machine, Slot, Source, Core (5×5), Belt
  packets/           Packet (circle only in v0.1)
  world/             Match, frame, Movement, Emission, BeltEditor, StabilityMeter
  rules.ts           TypeScript mirror of TOML
  load-rules.ts      [pipeline] validation
```

**Frame contract:** `PipelineFrame` in `game-server/pipeline/world/frame.ts` — persist in `Tower.frame`. Older types may still call the snapshot field `tree`; rename later.

## Actions

- `POST /api/towers/:id/place`, `remove`, `join`
- SSE `frame` pushes `PipelineFrame`

Invalid TOML or out-of-range values **abort** startup. The UI may display rules; the server revalidates before writing.

Portuguese overview that still documents older lobby/shell layout: [`arquitetura-jogo.md`](../../arquitetura-jogo.md). Living checklist: [`open-pipeline-wip.md`](../../open-pipeline-wip.md).

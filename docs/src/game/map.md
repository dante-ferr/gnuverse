# Game code map

Page `/jogo/` on the static site; authoritative match state in `game-server/pipeline/`; room UI in `src/components/game/pipeline/`. HTTP routes remain under `/api/towers`.

## Frontend

| Area | Key files |
| :--- | :--- |
| Lobby entry | `src/app/jogo/page.tsx` → `pipeline-lobby.tsx` (`PipelineLobby`) |
| Room page | `src/app/jogo/torre/page.tsx` → `pipeline/pipeline-room.tsx` (`PipelineRoom`) |
| Scene | `pipeline/scene/` — `PipelineScene`, camera, belt stroke, painters |
| Stream | `pipeline/hooks/use-pipeline-stream.ts` |
| Frame types | `pipeline/model/frame.ts` |
| Lobby API | `api/list-rooms.ts`, `api/create-room.ts` |
| Transport | `api/game-api.ts` (HTTP + SSE) |
| Auth | Dedicated login/register pages (see `AGENTS.md`); no inline auth in the room |

## Backend (`game-server/`)

| Area | Role |
| :--- | :--- |
| `pipeline/` | Grid sim: machines, packets, match, movement, emission, belts |
| `pipeline/load-rules.ts` | Validates `[pipeline]` from TOML (includes seeded layout fit check) |
| `rooms/` | `room-service`, `history-service` |
| `runtime/simulation-coordinator.ts` | Grid tick + SSE (no Matter) |
| `transport/` | HTTP routes, CORS |
| `auth/` | Sessions; `CMSIdentityProvider` |
| `persistence/` | SQLite WAL + single-writer lock; `State.rooms` (legacy `towers` key on read) |
| `config/game.config.toml` | All gameplay and presentation knobs |

### Pipeline layout

```text
game-server/pipeline/
  geometry/          direction, cell, clearance (generation free pads), seed-rng
  machines/          Machine, Slot, Source (3×3), Core (5×5), Belt
  packets/           Packet (circle only in v0.1)
  world/             Match, frame, types; chunks/, placement/, tick/, edit/, progression/
  rules.ts           TypeScript mirror of TOML
  load-rules.ts      [pipeline] validation
```

**Frame contract:** `PipelineFrame` in `game-server/pipeline/world/frame.ts` — live state on `Room.frame`; history in `Snapshot.frame`. Persisted under `State.rooms` in SQLite JSON (`game-store` still loads a legacy `towers` key when present).

**Match layout:** `Match.create(seed, rules)` centers the core and places sources from `rules.elements.starterSourceIds` via `world/chunks/match-layout.ts` and `world/placement/approach.ts` (clearance-separated procedural placement).

## Actions

- `POST /api/towers/:id/place`, `remove`, `join`
- SSE `frame` pushes `PipelineFrame`

Invalid TOML or out-of-range values **abort** startup. The UI may display rules; the server revalidates before writing.

Portuguese overview of the same layout: [`arquitetura-jogo.md`](../../arquitetura-jogo.md). Living checklist: [`open-pipeline-wip.md`](open-pipeline-wip.md).
import type { ServerResponse } from 'node:http'
import type { Room } from '../domain/types.ts'
import { fail } from '../domain/validation.ts'
import type { PipelineRules } from '../pipeline/rules.ts'
import { isPipelineFrame } from '../pipeline/world/frame.ts'
import { Match } from '../pipeline/world/match.ts'
import { GameStore } from '../persistence/game-store.ts'
import type { GovernanceService } from '../governance/governance-service.ts'

/** Steps every pipeline match and fans the frame out over SSE. */
export class SimulationCoordinator {
  private store: GameStore
  private rules: PipelineRules
  private streams = new Map<string, Set<ServerResponse>>()
  private timer?: ReturnType<typeof setInterval>

  constructor(store: GameStore, rules: PipelineRules) {
    this.store = store
    this.rules = rules
  }

  publicFrame(room: Room) {
    if (!isPipelineFrame(room.frame))
      fail(409, 'Esta sala é de uma versão anterior.')
    return room.frame
  }

  rollback() {}

  afterAction(room: Room) {
    this.publishChange(room.id)
  }

  publishChange(roomId: string) {
    for (const response of this.streams.get(roomId) ?? [])
      if (response.writableLength < 1024 * 1024)
        response.write('event: change\ndata: {}\n\n')
  }

  remove(roomId: string) {
    for (const response of this.streams.get(roomId) ?? []) response.end()
    this.streams.delete(roomId)
  }

  subscribe(room: Room, response: ServerResponse) {
    if ((this.streams.get(room.id)?.size ?? 0) >= 100)
      fail(503, 'Muitos espectadores.')
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    response.write(
      `event: frame\ndata: ${JSON.stringify(this.publicFrame(room))}\n\n`,
    )
    if (!this.streams.has(room.id)) this.streams.set(room.id, new Set())
    this.streams.get(room.id)!.add(response)
    response.on('close', () => this.streams.get(room.id)?.delete(response))
  }

  private step() {
    let needsSave = false
    for (const room of Object.values(this.store.state.rooms)) {
      if (!isPipelineFrame(room.frame)) continue
      const match = Match.fromFrame(room.frame, this.rules)
      match.tick()
      room.frame = match.toFrame()
      room.beltCount = room.frame.belts.length
      needsSave = true
    }
    return needsSave
  }

  start(governance: GovernanceService) {
    this.timer = setInterval(() => {
      try {
        const needsSave = this.step()
        for (const room of Object.values(this.store.state.rooms))
          governance.expireBans(room)
        for (const room of Object.values(this.store.state.rooms)) {
          if (!isPipelineFrame(room.frame)) continue
          for (const response of this.streams.get(room.id) ?? []) {
            if (response.writableLength > 256 * 1024) continue
            response.write(
              `event: frame\ndata: ${JSON.stringify(room.frame)}\n\n`,
            )
          }
        }
        if (needsSave) this.store.persist()
      } catch (error) {
        console.error('Game simulation failed:', error)
      }
    }, this.rules.tickMs)
    this.timer.unref()
  }

  close() {
    clearInterval(this.timer)
    for (const clients of this.streams.values())
      for (const response of clients) response.end()
  }
}

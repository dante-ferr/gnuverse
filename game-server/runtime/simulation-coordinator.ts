import type { ServerResponse } from 'node:http'
import type { Tower } from '../domain/types.ts'
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

  publicFrame(tower: Tower) {
    if (!isPipelineFrame(tower.frame))
      fail(409, 'Esta sala é de uma versão anterior.')
    return tower.frame
  }

  rollback() {}

  afterAction(tower: Tower) {
    this.publishChange(tower.id)
  }

  publishChange(towerId: string) {
    for (const response of this.streams.get(towerId) ?? [])
      if (response.writableLength < 1024 * 1024)
        response.write('event: change\ndata: {}\n\n')
  }

  remove(towerId: string) {
    for (const response of this.streams.get(towerId) ?? []) response.end()
    this.streams.delete(towerId)
  }

  subscribe(tower: Tower, response: ServerResponse) {
    if ((this.streams.get(tower.id)?.size ?? 0) >= 100)
      fail(503, 'Muitos espectadores.')
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    response.write(
      `event: frame\ndata: ${JSON.stringify(this.publicFrame(tower))}\n\n`,
    )
    if (!this.streams.has(tower.id)) this.streams.set(tower.id, new Set())
    this.streams.get(tower.id)!.add(response)
    response.on('close', () => this.streams.get(tower.id)?.delete(response))
  }

  private step() {
    let needsSave = false
    for (const tower of Object.values(this.store.state.towers)) {
      if (!isPipelineFrame(tower.frame) || tower.frame.crashed) continue
      const match = Match.fromFrame(tower.frame, this.rules)
      match.tick()
      tower.frame = match.toFrame()
      tower.segmentCount = tower.frame.belts.length
      needsSave = true
    }
    return needsSave
  }

  start(governance: GovernanceService) {
    this.timer = setInterval(() => {
      try {
        const needsSave = this.step()
        for (const tower of Object.values(this.store.state.towers))
          governance.expireBans(tower)
        for (const tower of Object.values(this.store.state.towers)) {
          if (!isPipelineFrame(tower.frame)) continue
          for (const response of this.streams.get(tower.id) ?? []) {
            if (response.writableLength > 256 * 1024) continue
            response.write(
              `event: frame\ndata: ${JSON.stringify(tower.frame)}\n\n`,
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

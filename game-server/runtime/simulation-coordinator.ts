import type { ServerResponse } from 'node:http'
import { createSimulation } from '../physics/index.ts'
import type { PublicFrame, Tower } from '../domain/types.ts'
import { fail } from '../domain/validation.ts'
import { GameStore } from '../persistence/game-store.ts'
import type { GovernanceService } from '../governance/governance-service.ts'
import type { HistoryService } from '../towers/history-service.ts'
import { WindService } from '../wind/wind-service.ts'

/** Owns engines, the authoritative clock and bounded spectator streams. */
export class SimulationCoordinator {
  private store: GameStore
  private now: () => number
  private simulations = new Map<string, ReturnType<typeof createSimulation>>()
  private streams = new Map<string, Set<ServerResponse>>()
  private timer?: ReturnType<typeof setInterval>
  constructor(store: GameStore, now: () => number) {
    this.store = store
    this.now = now
  }

  simulation(tower: Tower) {
    if (!this.simulations.has(tower.id))
      this.simulations.set(
        tower.id,
        createSimulation(tower.frame?.blocks ?? []),
      )
    return this.simulations.get(tower.id)!
  }
  frame(tower: Tower): PublicFrame {
    return {
      ...tower.frame,
      wind: tower.wind
        ? {
            phase: tower.wind.phase,
            endsAt: tower.wind.endsAt,
            direction: tower.wind.direction,
          }
        : null,
    }
  }
  rollback() {
    // A rejected request must not reset the sleep counters of an unchanged engine.
    for (const [id, simulation] of this.simulations) {
      const restored = this.store.state.towers[id]
      if (
        !restored ||
        JSON.stringify(simulation.read().blocks) !==
          JSON.stringify(restored.frame.blocks)
      ) {
        simulation.dispose()
        this.simulations.delete(id)
      }
    }
  }
  publishChange(towerId: string) {
    for (const response of this.streams.get(towerId) ?? [])
      if (response.writableLength < 1024 * 1024)
        response.write('event: change\ndata: {}\n\n')
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
      `event: frame\ndata: ${JSON.stringify(this.frame(tower))}\n\n`,
    )
    if (!this.streams.has(tower.id)) this.streams.set(tower.id, new Set())
    this.streams.get(tower.id)!.add(response)
    response.on('close', () => this.streams.get(tower.id)?.delete(response))
  }
  start(
    history: HistoryService,
    governance: GovernanceService,
    wind: WindService,
  ) {
    let ticks = 0
    this.timer = setInterval(() => {
      try {
        let needsSave = false
        for (const tower of Object.values(this.store.state.towers)) {
          governance.expireBans(tower)
          if (!tower.frame.settled || tower.pendingSnapshot || tower.wind) {
            const simulation = this.simulation(tower)
            if (wind.beforeStep(tower, simulation)) needsSave = true
            tower.frame = simulation.step()
            if (wind.afterStep(tower)) needsSave = true
          }
          if (tower.pendingSnapshot && tower.frame.settled && !tower.wind) {
            history.snapshot(
              tower,
              tower.lastActorId ?? null,
              'Construção estabilizada',
            )
            tower.pendingSnapshot = false
            needsSave = true
          }
          if (
            tower.proposals.some(
              (p) =>
                p.status === 'pending' &&
                p.mode === 'vote' &&
                this.now() >= p.closesAt!,
            )
          ) {
            governance.finishVoting(tower)
            needsSave = true
          }
          if (
            !tower.wind &&
            tower.frame.settled &&
            tower.proposals.some(
              (proposal) => proposal.executionStatus === 'deferred',
            )
          ) {
            governance.flushDeferred(tower)
            needsSave = true
          }
          if (ticks % 6 === 0)
            for (const response of this.streams.get(tower.id) ?? []) {
              if (response.writableLength > 1024 * 1024) {
                response.end()
                continue
              }
              response.write(
                `event: frame\ndata: ${JSON.stringify(this.frame(tower))}\n\n`,
              )
            }
        }
        if (needsSave || ticks % 60 === 0) this.store.persist()
        ticks++
      } catch (error) {
        console.error('Game simulation failed:', error)
      }
    }, 1000 / 60)
    this.timer.unref()
  }
  close() {
    clearInterval(this.timer)
    for (const clients of this.streams.values())
      for (const response of clients) response.end()
    for (const simulation of this.simulations.values()) simulation.dispose()
  }
}

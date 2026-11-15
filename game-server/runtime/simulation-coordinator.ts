import type { ServerResponse } from 'node:http'
import { createTreeSimulation } from '../physics/index.ts'
import { treeRules } from '../physics/tree-constants.ts'
import type { Tower } from '../domain/types.ts'
import { fail } from '../domain/validation.ts'
import { GameStore } from '../persistence/game-store.ts'
import type { GovernanceService } from '../governance/governance-service.ts'
import type { HistoryService } from '../towers/history-service.ts'
import {
  advanceFirefly,
  checkExitBloom,
  drainEnergy,
  evaluateStarvation,
  evaluateTrunkLoss,
  evaluateWin,
  harvestEnergy,
  openActionWindow,
  publicTreeFrame,
  returnToIdle,
  startPhysicsPhase,
} from '../tree/tree-phase-service.ts'
import { createInitialTreeFrame } from '../physics/map-gen.ts'
import type { TreeSimulation } from '../physics/tree/tree-simulation.ts'

/** Owns tree engines, turn phases and spectator streams. */
export class SimulationCoordinator {
  private store: GameStore
  private now: () => number
  private simulations = new Map<string, TreeSimulation>()
  private streams = new Map<string, Set<ServerResponse>>()
  private timer?: ReturnType<typeof setInterval>
  constructor(store: GameStore, now: () => number) {
    this.store = store
    this.now = now
  }

  simulation(tower: Tower): TreeSimulation {
    if (!this.simulations.has(tower.id)) {
      const sim = createTreeSimulation(tower.frame)
      this.simulations.set(tower.id, sim)
    }
    const sim = this.simulations.get(tower.id)!
    sim.restore(tower.frame)
    return sim
  }
  publicFrame(tower: Tower) {
    return publicTreeFrame(tower.frame, this.now())
  }
  rollback() {
    for (const [id, simulation] of this.simulations) {
      const restored = this.store.state.towers[id]
      if (!restored) {
        simulation.dispose()
        this.simulations.delete(id)
        continue
      }
      simulation.restore(restored.frame)
    }
  }
  afterAction(tower: Tower) {
    const now = this.now()
    if (tower.frame.turn.phase === 'idle') {
      tower.frame = openActionWindow(tower.frame, now)
      this.simulation(tower).setFrame(tower.frame)
    }
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
    this.simulations.get(towerId)?.dispose()
    this.simulations.delete(towerId)
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
  private tickTurnPhases() {
    let needsSave = false
    const now = this.now()
    for (const tower of Object.values(this.store.state.towers)) {
      if (tower.frame.outcome !== 'playing') continue
      const frame = tower.frame
      if (
        frame.turn.phase === 'actionWindow' &&
        frame.turn.phaseEndsAt !== null &&
        now >= frame.turn.phaseEndsAt
      ) {
        tower.frame = startPhysicsPhase(frame, now)
        this.simulation(tower).setPhase('physics', tower.frame.turn.phaseEndsAt, true)
        needsSave = true
      } else if (
        frame.turn.phase === 'physics' &&
        frame.turn.phaseEndsAt !== null &&
        now >= frame.turn.phaseEndsAt
      ) {
        const sim = this.simulation(tower)
        harvestEnergy(tower.frame, sim)
        drainEnergy(tower.frame)
        checkExitBloom(tower.frame, sim)
        evaluateTrunkLoss(tower.frame, sim)
        evaluateStarvation(tower.frame, sim)
        evaluateWin(tower.frame)
        advanceFirefly(tower.frame)
        tower.frame = returnToIdle(tower.frame)
        sim.setFrame(tower.frame)
        needsSave = true
      }
    }
    return needsSave
  }
  private stepPhysics() {
    let needsSave = false
    for (const tower of Object.values(this.store.state.towers)) {
      if (tower.frame.turn.phase !== 'physics' || tower.frame.outcome !== 'playing')
        continue
      let sim = this.simulations.get(tower.id)
      if (!sim) {
        sim = createTreeSimulation(tower.frame)
        this.simulations.set(tower.id, sim)
      }
      tower.frame = sim.step()
      needsSave = true
    }
    return needsSave
  }
  start(history: HistoryService, governance: GovernanceService) {
    let ticks = 0
    this.timer = setInterval(() => {
      try {
        let needsSave = this.tickTurnPhases()
        if (this.stepPhysics()) needsSave = true
        for (const tower of Object.values(this.store.state.towers))
          governance.expireBans(tower)
        for (const tower of Object.values(this.store.state.towers))
          for (const response of this.streams.get(tower.id) ?? []) {
            if (response.writableLength > 256 * 1024) continue
            response.write(
              `event: frame\ndata: ${JSON.stringify(this.publicFrame(tower))}\n\n`,
            )
          }
        if (needsSave || ticks % 60 === 0) this.store.persist()
        ticks++
      } catch (error) {
        console.error('Game simulation failed:', error)
      }
    }, 1000 / treeRules().physicsFps)
    this.timer.unref()
  }
  close() {
    clearInterval(this.timer)
    for (const clients of this.streams.values())
      for (const response of clients) response.end()
    for (const simulation of this.simulations.values()) simulation.dispose()
  }
  migrateTowerFrame(tower: Tower) {
    if (!tower.frame || !('nodes' in tower.frame)) {
      tower.frame = createInitialTreeFrame(this.now(), tower.id)
      tower.segmentCount = 0
      tower.actionCount = tower.actionCount ?? 0
    }
  }
}
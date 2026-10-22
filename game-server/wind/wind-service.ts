import type { Rules, Tower } from '../domain/types.ts'
import type { Simulation } from '../physics/index.ts'
import { HistoryService } from '../towers/history-service.ts'

const WIND_DURATION_MS = 5000

/** Placement thresholds and event phases survive restores and server restarts. */
export class WindService {
  private rules: Readonly<Rules>
  private now: () => number
  private history: HistoryService
  constructor(
    rules: Readonly<Rules>,
    now: () => number,
    history: HistoryService,
  ) {
    this.rules = rules
    this.now = now
    this.history = history
  }
  initialize(tower: Tower) {
    tower.placementCount ??= Object.values(tower.members).reduce(
      (total, member) => total + member.contributions,
      0,
    )
    tower.windMinBlocks ??= this.rules.windMinBlocks
    tower.windEveryBlocks ??= this.rules.windEveryBlocks
    if (tower.lastWindPlacementCount === undefined) {
      const triggers = tower.events
        .filter((event) => event.type === 'wind-scheduled')
        .map((event) => {
          const detail = event.detail
          if (
            !detail ||
            typeof detail !== 'object' ||
            !('placementCount' in detail)
          )
            return 0
          return typeof detail.placementCount === 'number' &&
            Number.isSafeInteger(detail.placementCount)
            ? detail.placementCount
            : 0
        })
      const last = Math.max(tower.wind?.triggerCount ?? 0, ...triggers)
      tower.lastWindPlacementCount = last > 0 ? last : null
    }
    // Legacy towers retain a saved schedule; missing schedules start in the future.
    if (tower.nextWindAt === undefined) this.recalculate(tower)
    tower.wind ??= null
  }
  recalculate(tower: Tower) {
    const threshold =
      tower.lastWindPlacementCount === null
        ? tower.windMinBlocks
        : tower.lastWindPlacementCount + tower.windEveryBlocks
    tower.nextWindAt = Math.max(tower.placementCount + 1, threshold)
  }
  placed(tower: Tower, actorId: string) {
    tower.placementCount++
    if (tower.placementCount < tower.nextWindAt) return
    tower.wind = {
      phase: 'pending',
      endsAt: null,
      direction: Math.random() < 0.5 ? -1 : 1,
      triggerCount: tower.placementCount,
      strength: this.rules.windStrength,
    }
    tower.lastWindPlacementCount = tower.placementCount
    tower.nextWindAt = tower.placementCount + tower.windEveryBlocks
    this.history.event(tower, 'wind-scheduled', actorId, {
      placementCount: tower.placementCount,
      nextWindAt: tower.nextWindAt,
      direction: tower.wind.direction,
    })
  }
  beforeStep(tower: Tower, simulation: Simulation): boolean {
    const wind = tower.wind
    if (!wind) return false
    let changed = false
    if (wind.phase === 'pending' && tower.frame.settled) {
      wind.phase = 'active'
      wind.endsAt = this.now() + WIND_DURATION_MS
      this.history.event(tower, 'wind-start', null, {
        triggerCount: wind.triggerCount,
        direction: wind.direction,
        strength: wind.strength,
        endsAt: wind.endsAt,
      })
      changed = true
    }
    if (wind.phase === 'active' && this.now() >= wind.endsAt!) {
      wind.phase = 'settling'
      this.history.event(tower, 'wind-end', null, {
        triggerCount: wind.triggerCount,
        endsAt: wind.endsAt,
      })
      changed = true
    }
    if (wind.phase === 'active')
      simulation.applyWind(wind.strength, wind.direction)
    return changed
  }
  afterStep(tower: Tower): boolean {
    if (tower.wind?.phase !== 'settling' || !tower.frame.settled) return false
    this.history.event(tower, 'wind-settled', null, {
      triggerCount: tower.wind.triggerCount,
    })
    tower.wind = null
    return true
  }
}

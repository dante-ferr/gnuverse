import { ahead, opposite } from '../../geometry/direction.ts'
import type { Match } from '../match.ts'
import { ejectOnto } from './routing.ts'

/** Emits from each in-play source onto a belt or a machine plugged into the output. */
export class Emission {
  private match: Match

  constructor(match: Match) {
    this.match = match
  }

  emit() {
    for (const source of this.match.sources) {
      if (!this.match.sourceEmitsInPlay(source)) continue
      const output = source.outputSlots()[0]
      if (!output) continue
      if (source.ticksUntilEmit > 0) {
        source.ticksUntilEmit -= 1
        continue
      }
      const rim = ahead(output.cell.x, output.cell.y, opposite(output.travel))
      if (!ejectOnto(this.match, rim, output, source.shape)) continue
      source.ticksUntilEmit = Math.max(0, source.periodTicks - 1)
    }
  }
}
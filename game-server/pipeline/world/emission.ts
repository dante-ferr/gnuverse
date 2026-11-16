import { cellKey } from '../geometry/cell.ts'
import { Packet } from '../packets/packet.ts'
import type { Match } from './match.ts'

/** Emits one circle from the source when its output belt cell is empty. */
export class Emission {
  private match: Match

  constructor(match: Match) {
    this.match = match
  }

  emit() {
    const source = this.match.source
    const output = source.outputSlots()[0]
    if (!output) return
    if (source.ticksUntilEmit > 0) {
      source.ticksUntilEmit -= 1
      return
    }
    const occupied = this.match.packets.some(
      (packet) => cellKey(packet.cell) === cellKey(output.cell),
    )
    const belt = this.match.beltAt(output.cell)
    if (!belt || occupied) return
    this.match.packets.push(
      new Packet(`p${this.match.nextPacketId++}`, { ...output.cell }, source.shape),
    )
    source.ticksUntilEmit = Math.max(0, source.periodTicks - 1)
  }
}
